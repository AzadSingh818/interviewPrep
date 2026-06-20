/**
 * scripts/audit-difficulty.ts
 *
 * Scans the database to identify sessions affected by the historical dropping
 * and recreating of the `sessions.difficulty` column, and restores their difficulty
 * levels from associated ManualBookingRequests where possible.
 *
 * Usage:
 *   npx ts-node -P tsconfig.json scripts/audit-difficulty.ts [--restore]
 *
 * Options:
 *   --restore    Perform the database updates to restore recovered difficulty levels.
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const shouldRestore = args.includes('--restore');

  console.log('🔍 Starting Historical Difficulty Data Audit...');
  console.log(`Mode: ${shouldRestore ? 'RESTORE (Modifying DB)' : 'DRY RUN (Read Only)'}\n`);

  // Fetch all sessions including their manual booking requests
  const sessions = await prisma.session.findMany({
    include: {
      manualBookingRequest: true,
      student: { select: { name: true } },
      interviewer: { select: { name: true } },
    },
  });

  const totalSessions = sessions.length;
  let healthySessions = 0;
  let affectedSessions = 0;
  let recoverableSessions = 0;
  let unrecoverableSessions = 0;

  const toRestoreList: Array<{ sessionId: number; difficulty: any }> = [];

  for (const session of sessions) {
    if (session.difficulty !== null) {
      healthySessions++;
    } else {
      affectedSessions++;
      const mbrDiff = session.manualBookingRequest?.difficulty;
      if (mbrDiff) {
        recoverableSessions++;
        toRestoreList.push({ sessionId: session.id, difficulty: mbrDiff });
      } else {
        unrecoverableSessions++;
      }
    }
  }

  console.log('📊 Audit Results Summary:');
  console.log('--------------------------------------------------');
  console.log(`Total sessions in database:                 ${totalSessions}`);
  console.log(`Healthy sessions (have difficulty set):     ${healthySessions}`);
  console.log(`Affected sessions (difficulty is NULL):     ${affectedSessions}`);
  console.log(`  - Recoverable (via Booking Request):      ${recoverableSessions}`);
  console.log(`  - Unrecoverable (no booking difficulty):  ${unrecoverableSessions}`);
  console.log('--------------------------------------------------\n');

  if (affectedSessions > 0) {
    if (recoverableSessions > 0) {
      console.log(`💡 Found ${recoverableSessions} sessions that can be restored.`);
      
      if (shouldRestore) {
        console.log('🚀 Restoring difficulty data...');
        let updatedCount = 0;
        for (const item of toRestoreList) {
          await prisma.session.update({
            where: { id: item.sessionId },
            data: { difficulty: item.difficulty },
          });
          updatedCount++;
        }
        console.log(`\n✅ Successfully restored difficulty for ${updatedCount} sessions.`);
      } else {
        console.log('👉 To apply these restorations, run the script with the --restore flag:');
        console.log('   npx ts-node -P tsconfig.json scripts/audit-difficulty.ts --restore');
      }
    } else {
      console.log('❌ None of the affected sessions have recoverable difficulty data in ManualBookingRequests.');
    }
  } else {
    console.log('✨ Clean bill of health! No affected sessions found.');
  }
}

main()
  .catch((err) => {
    console.error('❌ Script failed:', err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
