# 🔴 P0 SECRETS CONFIGURATION GUIDE

**Status:** Ready to Configure  
**Effort:** 15 minutes  
**Blocker:** YES - Must set before launch  
**Variables Needed:** 3 critical secrets

---

## 🎯 OVERVIEW

You need to set **3 environment variables** in Vercel:

| Secret | Purpose | Where to Get | Effort |
|--------|---------|--------------|--------|
| **CRON_SECRET** | Protect cron endpoints | Generate new | 1 min |
| **RAZORPAY_WEBHOOK_SECRET** | Webhook authentication | Razorpay dashboard | 3 min |
| **SENTRY_DSN** | Error tracking | Sentry project | 5 min |

**Optional (but recommended):**
| **SENTRY_AUTH_TOKEN** | Source maps upload | Sentry project | 2 min |

---

## 🔑 SECRET 1: CRON_SECRET

### What is it?
Secret key to protect `/api/cron/*` endpoints from unauthorized calls.

### How to Generate

**Option A: OpenSSL (Linux/Mac/Windows with Git Bash)**
```bash
openssl rand -base64 32
```

**Output Example:**
```
aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890AbCdE=
```

**Option B: Node.js**
```javascript
console.log(require('crypto').randomBytes(32).toString('base64'))
```

**Option C: Online Generator**
- Go to: https://www.random.org/cgi-bin/randbytes?nbytes=32&format=h
- Convert to base64 or just use a strong random string

### Where to Use
```
CRON_SECRET = <your-generated-secret>
```

### What It Does
- Secures `/api/cron/cleanup-rooms` endpoint
- Secures `/api/cron/cleanup-reminder-emails` endpoint
- Prevents unauthorized cron triggers

---

## 🔑 SECRET 2: RAZORPAY_WEBHOOK_SECRET

### What is it?
Secret key from Razorpay for signing webhook events.

### How to Get It

**Step 1: Login to Razorpay**
- Go to: https://dashboard.razorpay.com
- Sign in with your account

**Step 2: Navigate to Webhooks**
- Click: Settings (bottom left)
- Click: Webhooks

**Step 3: Find Your Webhook**
- Look for webhook at: `/api/webhooks/razorpay`
- Click on it

**Step 4: Copy Secret**
- You should see "Secret" field
- Click "Show" or copy button
- Format: `whsec_xxxxxxxxxxxxxxxxxx` or similar

### Alternative: Get from Settings
If webhook not created yet:
- Go to: Settings → API Keys
- Look for "Webhook Signature Secret"

### Where to Use
```
RAZORPAY_WEBHOOK_SECRET = <secret-from-razorpay>
```

### What It Does
- Signs all payment webhook events
- API validates signature to ensure genuine Razorpay events
- Prevents spoofed payment events

---

## 🔑 SECRET 3: SENTRY_DSN

### What is it?
DSN (Data Source Name) for connecting to your Sentry error tracking project.

### How to Get It

**Step 1: Login to Sentry** (or create account)
- Go to: https://sentry.io
- Sign in (or create free account)

**Step 2: Create/Select Project**
- If new: Click "Create Project"
- Select: "Next.js" platform
- Name it: "InterviewPrep" (or your project name)

**Step 3: Get DSN**
- Project Settings → Client Keys (DSN)
- Copy the DSN URL
- Format: `https://xxxxx@xxxxx.ingest.sentry.io/123456`

**Step 4: Optional - Get Auth Token**
- Go to: Settings → Auth Tokens
- Create new token (if needed for source maps)
- Permissions: `project:read`, `project:releases`
- Copy token

### Where to Use
```
SENTRY_DSN = <dsn-from-sentry>

# Optional (for source maps):
SENTRY_AUTH_TOKEN = <auth-token-from-sentry>
```

### What It Does
- Tracks all errors in production
- Sends error reports to Sentry dashboard
- Monitors payment, AI, cron, email failures
- Shows error trends and stack traces

---

## 📋 15-MINUTE SETUP GUIDE

### Minute 1-2: Generate CRON_SECRET
```bash
openssl rand -base64 32
# Copy the output
```

### Minute 3-5: Get RAZORPAY_WEBHOOK_SECRET
1. Go to: https://dashboard.razorpay.com
2. Settings → Webhooks
3. Find webhook, copy secret

### Minute 6-10: Get SENTRY_DSN
1. Go to: https://sentry.io
2. Create/select project
3. Settings → Client Keys (DSN)
4. Copy DSN URL

### Minute 11-15: Add to Vercel
1. Go to: https://vercel.com/dashboard
2. Select project → Settings → Environment Variables
3. Add all 3 secrets
4. Redeploy

---

## 🚀 ADDING TO VERCEL

### Step 1: Login to Vercel
- Go to: https://vercel.com/dashboard
- Select your project

### Step 2: Go to Environment Variables
- Click: Settings (top menu)
- Click: Environment Variables (left sidebar)

### Step 3: Add Variables

**Add CRON_SECRET:**
- Name: `CRON_SECRET`
- Value: `<your-generated-secret>`
- Environments: Production, Preview, Development (select all)
- Click: Save

**Add RAZORPAY_WEBHOOK_SECRET:**
- Name: `RAZORPAY_WEBHOOK_SECRET`
- Value: `<secret-from-razorpay>`
- Environments: Production, Preview, Development
- Click: Save

**Add SENTRY_DSN:**
- Name: `SENTRY_DSN`
- Value: `<dsn-from-sentry>`
- Environments: Production, Preview, Development
- Click: Save

**Add SENTRY_AUTH_TOKEN (Optional):**
- Name: `SENTRY_AUTH_TOKEN`
- Value: `<auth-token-from-sentry>`
- Environments: Production only (for build)
- Click: Save

### Step 4: Redeploy
```bash
git push origin main
```
or click "Redeploy" in Vercel dashboard

---

## ✅ VERIFICATION

### Check if Variables Are Set
1. In Vercel dashboard: Settings → Environment Variables
2. All 3 should be listed with green checkmarks ✓

### Check if Applied
1. Deploy/Redeploy application
2. Check logs: `vercel logs --follow`
3. Variables should load without errors

### Test CRON_SECRET
```bash
curl https://your-domain.com/api/cron/cleanup-rooms?secret=<your-secret>
# Should return: 200 OK (or success response)
```

### Test RAZORPAY_WEBHOOK_SECRET
1. After webhook is configured
2. Try test webhook from Razorpay
3. Should verify signature and process event

### Test SENTRY_DSN
1. Trigger error in app (for testing)
2. Go to Sentry dashboard
3. Error should appear in project

---

## 🔐 SECURITY BEST PRACTICES

✅ **DO:**
- Generate strong secrets (32+ characters)
- Store in Vercel (not in code)
- Use different secrets for dev/staging/prod
- Rotate secrets periodically
- Keep backups of secrets

❌ **DON'T:**
- Commit secrets to git
- Share secrets via email/chat
- Use weak/simple secrets
- Reuse secrets across projects
- Log secrets to console

---

## 🆘 TROUBLESHOOTING

### Issue: "CRON_SECRET not found"
**Reason:** Not set in environment variables  
**Fix:** Add to Vercel, redeploy

### Issue: "Webhook signature verification failed"
**Reason:** RAZORPAY_WEBHOOK_SECRET doesn't match  
**Fix:** Copy correct secret from Razorpay dashboard again

### Issue: "Sentry errors not appearing"
**Reason:** SENTRY_DSN incorrect or not set  
**Fix:** Verify DSN format starts with `https://`

### Issue: "Can't find Environment Variables in Vercel"
**Reason:** Looking in wrong place  
**Fix:** Project → Settings (top menu) → Environment Variables (left)

---

## 📝 COMPLETION CHECKLIST

```
[ ] Generated CRON_SECRET (openssl rand -base64 32)
[ ] Copied RAZORPAY_WEBHOOK_SECRET from Razorpay dashboard
[ ] Copied SENTRY_DSN from Sentry project
[ ] Added CRON_SECRET to Vercel
[ ] Added RAZORPAY_WEBHOOK_SECRET to Vercel
[ ] Added SENTRY_DSN to Vercel
[ ] Added SENTRY_AUTH_TOKEN to Vercel (optional)
[ ] Redeployed application (git push or click Redeploy)
[ ] Verified all variables are set (green checkmarks in Vercel)
[ ] ✅ READY FOR PRODUCTION
```

---

## 🎯 WHAT HAPPENS NEXT

Once secrets are set:
- ✅ Cron endpoints are protected
- ✅ Webhooks verify signatures correctly
- ✅ Errors are tracked in Sentry
- ✅ Production monitoring is active
- ✅ Ready to launch

---

## 📊 ENVIRONMENT VARIABLE CHECKLIST

| Variable | Type | Set? | Value Format |
|----------|------|------|--------------|
| CRON_SECRET | Required | [ ] | Base64 string (32+ chars) |
| RAZORPAY_WEBHOOK_SECRET | Required | [ ] | Secret from Razorpay |
| SENTRY_DSN | Required | [ ] | `https://xxx@xxx.ingest.sentry.io/xxx` |
| SENTRY_AUTH_TOKEN | Optional | [ ] | Token from Sentry |

**Mark boxes when added to Vercel ✓**

---

## ✨ AFTER SECRETS ARE SET

- **P0: Migrations** → Apply with `npx prisma db push`
- **P0: Webhook** → Configure in Razorpay dashboard
- **P0: Secrets** ← YOU ARE HERE
- **P0: Smoke Test** → Verify everything works
- **LAUNCH** 🚀

---

**Status: DOCUMENTATION READY ✅**  
**Your Action: Generate & add secrets to Vercel (15 min)**
