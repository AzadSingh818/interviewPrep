/**
 * scripts/seed-admin.ts
 *
 * Safe script to promote an existing user to the ADMIN role.
 *
 * Usage:
 *   npx ts-node -P tsconfig.json scripts/seed-admin.ts admin@example.com
 *
 * Or with the package.json script:
 *   npm run seed:admin -- admin@example.com
 *
 * Requirements:
 *   - DATABASE_URL must be set in the environment (or .env file)
 *   - The user must already exist (created through normal signup flow)
 *   - Only EMAIL-provider accounts should be promoted to ADMIN
 *
 * Security notes:
 *   - Never run this script in CI or expose it as an API endpoint.
 *   - Track all admin promotions in your audit log / git history.
 *   - To revoke admin access, run: npm run seed:admin -- revoke admin@example.com
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isRevoke = args[0] === 'revoke';
  const email = isRevoke ? args[1] : args[0];

  if (!email || !email.includes('@')) {
    console.error('❌ Usage: ts-node scripts/seed-admin.ts [revoke] <email>');
    console.error('   Example: ts-node scripts/seed-admin.ts admin@example.com');
    console.error('   Revoke:  ts-node scripts/seed-admin.ts revoke admin@example.com');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, provider: true },
  });

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    console.error('   The user must sign up before being promoted to admin.');
    process.exit(1);
  }

  if (isRevoke) {
    // Revoke admin → default STUDENT role (adjust if needed)
    if (user.role !== 'ADMIN') {
      console.log(`ℹ️  User ${email} is not an admin (current role: ${user.role}). Nothing to revoke.`);
      process.exit(0);
    }

    await prisma.user.update({
      where: { id: user.id },
      // Increment tokenVersion to invalidate any existing admin sessions immediately
      data: { role: 'STUDENT', tokenVersion: { increment: 1 } },
    });

    console.log(`✅ Admin access revoked for: ${email}`);
    console.log(`   Role changed: ADMIN → STUDENT`);
    console.log(`   Active sessions invalidated (tokenVersion incremented).`);
  } else {
    // Promote to admin
    if (user.role === 'ADMIN') {
      console.log(`ℹ️  User ${email} is already an admin. Nothing to do.`);
      process.exit(0);
    }

    if (user.provider !== 'EMAIL') {
      console.warn(
        `⚠️  Warning: This user signed up via ${user.provider}. ` +
          'Consider using an EMAIL-only admin account for security.',
      );
    }

    const previous = user.role;
    await prisma.user.update({
      where: { id: user.id },
      // Increment tokenVersion to force a fresh login after promotion
      data: { role: 'ADMIN', tokenVersion: { increment: 1 } },
    });

    console.log(`✅ User promoted to ADMIN: ${email}`);
    console.log(`   Role changed: ${previous} → ADMIN`);
    console.log(`   Previous sessions invalidated (tokenVersion incremented).`);
    console.log(`   The user must log in again to get an ADMIN-role token.`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Script failed:', err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
