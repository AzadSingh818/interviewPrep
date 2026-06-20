# Admin Guide — InterviewPrep Live

## Overview

Admin users have full access to the admin dashboard and can approve/reject interviewer applications, view all sessions, and manage users.

---

## Creating an Admin Account

Admin accounts are created by promoting an existing user via a secure CLI script.
**Never promote users through the production API** — always use the script from a trusted machine with a direct DB connection.

### Prerequisites

1. User must already exist (signed up through the normal flow).
2. You must have `DATABASE_URL` set in your environment (or `.env`).
3. You need Node.js + `ts-node` installed (`npm install -g ts-node`).

### Promote a User

```bash
# From the project root
npx ts-node -P tsconfig.json scripts/seed-admin.ts admin@yourdomain.com
```

**What the script does:**
- Finds the user by email (fails if not found)
- Changes `role` from `STUDENT`/`INTERVIEWER` → `ADMIN`
- Increments `tokenVersion` to immediately invalidate any existing sessions
- Prints a confirmation with the old and new role

After running, the user must **log in again** to get a token with the ADMIN role.

---

## Revoking Admin Access

```bash
npx ts-node -P tsconfig.json scripts/seed-admin.ts revoke admin@yourdomain.com
```

**What the script does:**
- Changes `role` from `ADMIN` → `STUDENT`
- Increments `tokenVersion` to immediately invalidate all active admin sessions
- The user's session is invalidated server-side within seconds

---

## Add the npm Script (Optional)

Add to `package.json` for convenience:

```json
"scripts": {
  "seed:admin": "ts-node -P tsconfig.json scripts/seed-admin.ts"
}
```

Then run:
```bash
npm run seed:admin -- admin@yourdomain.com
npm run seed:admin -- revoke admin@yourdomain.com
```

---

## Admin-Only Routes

The following API routes require `role: ADMIN`:

| Route | Purpose |
|---|---|
| `GET /api/admin/*` | Admin management endpoints |
| Any route calling `requireAuth(['ADMIN'])` | Admin-gated data |

If a non-admin token reaches these routes, they return `403 Forbidden`.

---

## ADMIN_EMAILS Environment Variable

The `ADMIN_EMAILS` env var (comma-separated) is used by `isAdminEmail()` in auth.ts.
This is a **supplemental check** used during sign-up/sign-in flows (e.g., to auto-assign admin role on first Google OAuth login for known admin emails).

**This does NOT replace role-based DB checks.** All authorization is enforced via the DB `role` column.

```env
ADMIN_EMAILS=admin@yourdomain.com,ops@yourdomain.com
```

---

## Security Checklist

- [ ] Admin accounts use strong, unique passwords or are EMAIL-provider only.
- [ ] `ADMIN_EMAILS` is rotated when an admin leaves.
- [ ] Admin promotions are tracked in git history (script is run from a feature branch).
- [ ] Admin sessions are revoked immediately when an admin leaves (`revoke` script).
- [ ] All admin actions are logged in application logs (Vercel/Railway log aggregator).

---

## Rotation Process

When an admin leaves:
1. Run `npm run seed:admin -- revoke admin@example.com`
2. Remove their email from `ADMIN_EMAILS` in Vercel env vars
3. Redeploy to pick up the new env var
4. Verify they can no longer access admin routes (401/403)
