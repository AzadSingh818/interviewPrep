/**
 * Email job queue helpers.
 *
 * Instead of sending emails synchronously in API routes, callers
 * write an EmailJob row to the DB (atomically inside any existing
 * transaction). A cron worker (`/api/cron/process-email-jobs`) picks
 * up PENDING jobs and sends them with retry + exponential backoff.
 */

import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { env, getOptionalEnv } from '@/lib/env';
import { Prisma } from '@prisma/client';

// ─── Retry backoff delays (seconds) ──────────────────────────────────────────
// Retry 1: +60s, Retry 2: +300s (5 min), Retry 3: +1800s (30 min)
const BACKOFF_SECONDS = [60, 300, 1800];

function nextRetryDelay(retryCount: number): number {
  return BACKOFF_SECONDS[retryCount] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1];
}

// ─── Transporter (shared singleton) ──────────────────────────────────────────
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: getOptionalEnv('SMTP_HOST', 'smtp.gmail.com'),
      port: parseInt(getOptionalEnv('SMTP_PORT', '587') || '587'),
      secure: false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }
  return _transporter;
}

// ─── Public: Enqueue an email job ────────────────────────────────────────────

export interface EnqueueEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  /** Optionally pass a Prisma transaction client so the job is written atomically. */
  tx?: Prisma.TransactionClient;
}

export async function enqueueEmailJob(opts: EnqueueEmailOptions): Promise<void> {
  const appName =
    opts.fromName ??
    getOptionalEnv('NEXT_PUBLIC_APP_NAME', 'InterviewPrep Live') ??
    'InterviewPrep Live';

  const db = opts.tx ?? prisma;

  await db.emailJob.create({
    data: {
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? null,
      fromName: appName,
      status: 'PENDING',
    },
  });
}

// ─── Internal: Send one job and mark it done or schedule retry ───────────────

async function processOneJob(jobId: number): Promise<'sent' | 'retry' | 'failed'> {
  // Claim the job atomically so concurrent cron calls don't double-send
  const claimed = await prisma.emailJob.updateMany({
    where: { id: jobId, status: 'PENDING' },
    data: { status: 'PROCESSING' },
  });
  if (claimed.count === 0) return 'retry'; // already claimed

  const job = await prisma.emailJob.findUnique({ where: { id: jobId } });
  if (!job) return 'failed';

  const appName = job.fromName ?? 'InterviewPrep Live';

  try {
    await getTransporter().sendMail({
      from: `"${appName}" <${env.SMTP_USER}>`,
      to: job.to,
      subject: job.subject,
      html: job.html,
      ...(job.text ? { text: job.text } : {}),
    });

    await prisma.emailJob.update({
      where: { id: jobId },
      data: { status: 'SENT', processedAt: new Date(), lastError: null },
    });

    return 'sent';
  } catch (err: any) {
    const newRetryCount = job.retryCount + 1;
    const isExhausted = newRetryCount >= job.maxRetries;
    const delaySeconds = nextRetryDelay(job.retryCount);
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: isExhausted ? 'FAILED' : 'PENDING',
        retryCount: newRetryCount,
        nextRetryAt: isExhausted ? null : nextRetryAt,
        lastError: err?.message ?? 'Unknown error',
      },
    });

    return isExhausted ? 'failed' : 'retry';
  }
}

// ─── Public: Process all due jobs (called by cron) ───────────────────────────

export async function processPendingEmailJobs(): Promise<{
  processed: number;
  sent: number;
  retried: number;
  failed: number;
}> {
  const now = new Date();

  // Pick jobs that are PENDING and either have no nextRetryAt or it's in the past
  const dueJobs = await prisma.emailJob.findMany({
    where: {
      status: 'PENDING',
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 50, // process at most 50 per cron run to stay within serverless timeout
  });

  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const job of dueJobs) {
    const result = await processOneJob(job.id);
    if (result === 'sent') sent++;
    else if (result === 'retry') retried++;
    else failed++;
  }

  return { processed: dueJobs.length, sent, retried, failed };
}
