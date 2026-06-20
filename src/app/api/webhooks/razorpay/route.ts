import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { readRequiredEnv } from '@/lib/env';
import { processCapturedPayment, processFailedPayment } from '@/lib/payments';
import { captureError, captureEvent } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', readRequiredEnv('RAZORPAY_WEBHOOK_SECRET'))
    .update(rawBody)
    .digest('hex');

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function paymentEntityFromPayload(payload: any) {
  return payload?.payload?.payment?.entity ?? null;
}

function orderIdFromPayload(payload: any) {
  return (
    paymentEntityFromPayload(payload)?.order_id ||
    payload?.payload?.order?.entity?.id ||
    null
  );
}

function paymentIdFromPayload(payload: any) {
  return paymentEntityFromPayload(payload)?.id || null;
}

function eventIdFromPayload(payload: any) {
  const event = String(payload?.event || 'unknown');
  const orderId = orderIdFromPayload(payload) || 'no_order';
  const paymentId = paymentIdFromPayload(payload) || payload?.payload?.order?.entity?.id || 'no_payment';
  return String(payload?.id || `${event}:${orderId}:${paymentId}`);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook JSON' }, { status: 400 });
  }

  const eventType = String(payload?.event || 'unknown');
  const eventId = eventIdFromPayload(payload);
  const orderId = orderIdFromPayload(payload);
  const paymentId = paymentIdFromPayload(payload);

  const existing = await prisma.paymentWebhookEvent.upsert({
    where: { eventId },
    create: {
      eventId,
      eventType,
      orderId,
      paymentId,
      payload: payload as Prisma.InputJsonValue,
    },
    update: {
      eventType,
      orderId,
      paymentId,
      payload: payload as Prisma.InputJsonValue,
    },
    select: { processedAt: true },
  });

  if (existing?.processedAt) {
    captureEvent('webhook.duplicate', { route: '/api/webhooks/razorpay', eventType, orderId: orderId ?? undefined, paymentId: paymentId ?? undefined });
    return NextResponse.json({ success: true, duplicate: true });
  }

  try {
    if (eventType === 'payment.captured') {
      if (!orderId || !paymentId) {
        throw new Error('Webhook missing order or payment id');
      }
      await processCapturedPayment({ orderId, paymentId });
    } else if (eventType === 'order.paid') {
      if (orderId && paymentId) {
        await processCapturedPayment({ orderId, paymentId });
      }
    } else if (eventType === 'payment.failed') {
      if (!orderId) {
        throw new Error('Webhook missing order id');
      }
      await processFailedPayment(orderId);
    }

    captureEvent('webhook.processed', { route: '/api/webhooks/razorpay', eventType, orderId: orderId ?? undefined, paymentId: paymentId ?? undefined });
    await prisma.paymentWebhookEvent.update({
      where: { eventId },
      data: {
        processedAt: new Date(),
        processingError: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    await prisma.paymentWebhookEvent.update({
      where: { eventId },
      data: { processingError: error.message || 'Webhook processing failed' },
    });

    captureError(error, { route: '/api/webhooks/razorpay', eventType, orderId: orderId ?? undefined, paymentId: paymentId ?? undefined });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
