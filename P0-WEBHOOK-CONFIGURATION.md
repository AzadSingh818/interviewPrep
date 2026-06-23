# 🔴 P0 WEBHOOK CONFIGURATION GUIDE

**Status:** Ready to Configure  
**Endpoint:** `/api/webhooks/razorpay` ✅ Code Complete  
**Effort:** 15 minutes  
**Blocker:** YES - Must complete before launch  

---

## ✅ VERIFICATION: WEBHOOK ENDPOINT IS READY

Your webhook code is fully implemented:
- ✅ Signature verification (HMAC-SHA256)
- ✅ Idempotency check (duplicate detection)
- ✅ Error handling (logs to Sentry)
- ✅ Business event tracking
- ✅ Payment processing integration

**Ready to register with Razorpay!**

---

## 🚀 STEP-BY-STEP CONFIGURATION

### Step 1: Get Your Domain
```
Your webhook URL will be:
https://your-production-domain.com/api/webhooks/razorpay
```

**Where to find:**
- If on Vercel: `https://<project-name>.vercel.app/api/webhooks/razorpay`
- If custom domain: `https://yourdomain.com/api/webhooks/razorpay`

---

### Step 2: Login to Razorpay Dashboard

1. Go to: **https://dashboard.razorpay.com**
2. Sign in with your account
3. Navigate to: **Settings** → **Webhooks**

---

### Step 3: Create New Webhook

**In Razorpay Dashboard:**

1. Click **"+ Add New Webhook"**

2. Fill in the form:
   ```
   URL: https://your-production-domain.com/api/webhooks/razorpay
   
   Events to Subscribe:
   ✓ payment.captured
   ✓ payment.failed
   ✓ order.paid
   
   (Optional but recommended):
   ✓ payment.authorized
   ✓ subscription.triggered
   ```

3. Click **Save**

---

### Step 4: Get Your Webhook Secret

After saving, Razorpay will show you the webhook:

1. **Copy the Webhook ID** (looks like: `webhook_XXXXXXXXX`)
2. **Click on the webhook** to view details
3. **Copy the Secret** (you'll need this for `RAZORPAY_WEBHOOK_SECRET`)

---

### Step 5: Set Environment Variables

**In Vercel Dashboard:**

1. Go to: **Project Settings** → **Environment Variables**
2. Add/Update:

```
RAZORPAY_WEBHOOK_SECRET = <paste-the-secret-from-step-4>
```

**Redeploy** to apply changes:
```bash
git push origin main
```

---

### Step 6: Test the Webhook

**Manual Test (from Razorpay Dashboard):**

1. Go back to **Settings → Webhooks**
2. Find your webhook
3. Click **"Test Webhook"** button
4. Select an event type (e.g., `payment.captured`)
5. Click **Send**

**You should see:**
```
Status: ✅ Success (200 OK)
Response Time: <1 second
```

---

### Step 7: Verify in Code

The webhook endpoint handles:

| Event | Action |
|-------|--------|
| `payment.captured` | Grant subscription access |
| `order.paid` | Grant feature unlock |
| `payment.failed` | Mark order as failed |

---

## 🔧 TROUBLESHOOTING

### Issue: "Invalid webhook signature"
**Reason:** RAZORPAY_WEBHOOK_SECRET doesn't match  
**Fix:** 
1. Copy secret from Razorpay dashboard again
2. Paste to Vercel environment variables
3. Redeploy

### Issue: "Webhook not responding"
**Reason:** Domain not reachable  
**Fix:**
1. Test: `curl https://your-domain.com/api/webhooks/razorpay` (should show 405 - expected)
2. Verify domain is live and accessible

### Issue: "Webhook processing failed"
**Reason:** Database error or missing data  
**Fix:**
1. Check Sentry for error details
2. Verify database is running
3. Check order exists in database

---

## ✅ VERIFICATION CHECKLIST

```
[ ] Logged into Razorpay Dashboard
[ ] Created new webhook at /api/webhooks/razorpay endpoint
[ ] Selected 3 events (payment.captured, payment.failed, order.paid)
[ ] Copied webhook secret
[ ] Added RAZORPAY_WEBHOOK_SECRET to Vercel env vars
[ ] Redeployed application
[ ] Tested webhook from Razorpay dashboard (200 OK)
[ ] Confirmed status: Active ✓
```

**All checked?** → ✅ WEBHOOK CONFIGURED

---

## 📊 WEBHOOK EVENT FLOW

```
┌─────────────────────────────────────────────────────────┐
│ 1. USER COMPLETES PAYMENT IN APP                        │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. RAZORPAY SENDS WEBHOOK EVENT                         │
│    POST /api/webhooks/razorpay                          │
│    X-Razorpay-Signature: <HMAC-SHA256>                  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. YOUR API VERIFIES SIGNATURE                          │
│    ✓ Signature matches RAZORPAY_WEBHOOK_SECRET         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. CHECK FOR DUPLICATES                                 │
│    ✓ Store eventId in paymentWebhookEvent table         │
│    ✓ Skip if already processed                          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 5. PROCESS EVENT                                        │
│    ✓ payment.captured → Grant subscription              │
│    ✓ payment.failed → Mark order failed                 │
│    ✓ Track in Sentry                                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 6. MARK PROCESSED                                       │
│    ✓ Set processedAt timestamp                          │
│    ✓ Return 200 OK to Razorpay                          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 7. USER SEES SUCCESS                                    │
│    ✓ Dashboard shows active subscription                │
│    ✓ Feature unlocked                                   │
│    ✓ Email sent                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 WEBHOOK SECURITY CHECKLIST

Your implementation includes:

✅ **Signature Verification**
- HMAC-SHA256 with timing-safe comparison
- Prevents forged/tampered webhooks

✅ **Idempotency**
- Duplicate detection by eventId
- Safe to retry without double-charging

✅ **Error Handling**
- Errors logged to Sentry with context
- Failed webhooks marked for retry

✅ **PII Protection**
- No sensitive data logged
- Sentry scrubbing enabled

✅ **Business Logic**
- Linked to correct order/payment
- Proper entitlement granting

---

## 🎯 AFTER CONFIGURATION

1. **Test in staging first** (if you have staging database)
2. **Monitor Sentry** for webhook errors
3. **Check database** for `paymentWebhookEvent` entries
4. **Verify users** get subscriptions after payment

---

## 📞 SUPPORT

**If webhook fails:**
1. Check Sentry dashboard for errors
2. Verify environment variables
3. Check Razorpay webhook logs
4. Verify database is accessible

**Razorpay Support:** support@razorpay.com

---

## ✅ COMPLETION

When completed:
- [ ] Webhook registered with Razorpay ✓
- [ ] Secret in Vercel environment ✓
- [ ] Test webhook passed ✓
- [ ] Ready for production ✓

**Status: READY FOR LAUNCH** 🚀
