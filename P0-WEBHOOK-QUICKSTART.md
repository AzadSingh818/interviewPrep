# 🎯 P0 WEBHOOK - QUICK START CHECKLIST

**Time:** 15 minutes  
**Difficulty:** Easy (7-10 clicks in Razorpay dashboard)  
**Status:** READY NOW ✅

---

## ⏱️ 15-MINUTE QUICKSTART

### Minute 1-2: Login & Navigate
```
1. Go to: https://dashboard.razorpay.com
2. Login with your account
3. Click: Settings → Webhooks
```

### Minute 3-5: Create Webhook
```
1. Click: "+ Add New Webhook"
2. URL: https://your-domain.com/api/webhooks/razorpay
3. Events: ✓ payment.captured, ✓ payment.failed, ✓ order.paid
4. Click: Save
```

### Minute 6-8: Copy Secret
```
1. Click on your webhook
2. Copy the Secret (XXXXXXXXXXXXXXXX)
3. Keep this safe
```

### Minute 9-12: Set Environment Variable
```
1. Go to: https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add: RAZORPAY_WEBHOOK_SECRET = <paste-secret>
5. Redeploy (git push origin main)
```

### Minute 13-15: Test Webhook
```
1. Back to Razorpay webhooks
2. Click: "Test Webhook"
3. Select: "payment.captured"
4. Click: Send
5. Status: ✅ 200 OK
```

---

## ✅ COMPLETION CRITERIA

When you see this, you're done:

```
✓ Webhook registered in Razorpay
✓ Environment variable set in Vercel
✓ Test webhook returns 200 OK
✓ Dashboard shows "Active" status
```

---

## 🚀 NEXT AFTER THIS

→ **P0: Smoke Test** (15 min)
   - Test subscription payment
   - Test feature unlock
   - Test logout
   - Test cron

→ **LAUNCH PRODUCTION** 🎉

---

## 🆘 QUICK HELP

**Can't find Webhooks?**
- Dashboard → Settings (bottom) → Webhooks

**Don't know your domain?**
- Vercel: `https://<project-name>.vercel.app/api/webhooks/razorpay`

**Test webhook not working?**
- Make sure RAZORPAY_WEBHOOK_SECRET is in Vercel (redeploy if just added)

**Need more help?**
- Read: P0-WEBHOOK-CONFIGURATION.md (detailed guide)

---

## ✅ CHECKLIST

```
[ ] Step 1: Login to Razorpay (1 min)
[ ] Step 2: Create webhook (3 min)
[ ] Step 3: Copy secret (2 min)
[ ] Step 4: Add to Vercel (4 min)
[ ] Step 5: Test (5 min)
[ ] ✅ DONE - Ready for smoke test
```

**Estimated Total Time:** 15 minutes ⏱️

---

## 🎉 AFTER COMPLETION

Webhook is now active and ready to:
- Receive payment events from Razorpay
- Grant subscriptions automatically
- Grant feature unlocks automatically
- Log all events to database
- Send errors to Sentry

**Status: P0 WEBHOOK ✅ COMPLETE**
