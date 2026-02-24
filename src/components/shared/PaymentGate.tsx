'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentGateProps {
  planType: 'FREE' | 'PRO';
  used: number;
  limit: number;
  sessionType: 'interview' | 'guidance';
  onPaymentSuccessAction: () => void;
}

export function PaymentGate({ planType, used, limit, sessionType, onPaymentSuccessAction }: PaymentGateProps) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const loadRazorpayScript = () =>
    new Promise<boolean>((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePayment = async () => {
    setError('');
    setPaying(true);

    try {
      // 1. Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setError('Failed to load payment gateway. Please check your connection.');
        return;
      }

      // 2. Create order on backend
      const orderRes = await fetch('/api/payment/create-order', { method: 'POST' });
      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        setError(orderData.error || 'Failed to initiate payment.');
        return;
      }

      // 3. Fetch user details for prefill
      const profileRes = await fetch('/api/student/profile');
      const profileData = await profileRes.json();
      const userEmail = profileData.user?.email ?? '';
      const userName = profileData.profile?.name ?? profileData.user?.name ?? '';

      // 4. Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'InterviewPrepLive',
        description: 'Pro Plan — ₹99/month (10 Interviews + 10 Guidance)',
        order_id: orderData.orderId,
        prefill: { name: userName, email: userEmail },
        theme: { color: '#6366f1' },
        modal: {
          ondismiss: () => {
            setPaying(false);
          },
        },
        handler: async (response: any) => {
          // 5. Verify payment on backend
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              onPaymentSuccessAction();
            } else {
              setError(verifyData.error || 'Payment verification failed. Contact support.');
            }
          } catch {
            setError('Payment verification error. Please contact support.');
          } finally {
            setPaying(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setPaying(false);
    }
  };

  const isFreePlan = planType === 'FREE';
  const sessionLabel = sessionType === 'interview' ? 'Mock Interviews' : 'Guidance Sessions';

  return (
    <div className="max-w-lg mx-auto">
      {/* Limit reached banner */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 mb-6 text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h2 className="text-xl font-bold text-amber-900 mb-2">
          {isFreePlan ? 'Free Trial Limit Reached' : 'Monthly Limit Reached'}
        </h2>
        <p className="text-amber-800 text-sm">
          You've used <strong>{used}/{limit}</strong> {sessionLabel}.{' '}
          {isFreePlan
            ? 'Your free trial is complete.'
            : 'Your monthly plan has been fully used.'}
        </p>
      </div>

      {/* Usage progress */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>{sessionLabel} used</span>
          <span className="font-semibold text-slate-900">{used} / {limit}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-amber-400 to-red-500 h-3 rounded-full transition-all"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Pro plan card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 text-white mb-6 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-indigo-200 text-sm font-medium uppercase tracking-wider">
              {isFreePlan ? 'Upgrade to' : 'Renew'}
            </p>
            <h3 className="text-3xl font-bold">Pro Plan</h3>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">₹99</p>
            <p className="text-indigo-200 text-sm">per month</p>
          </div>
        </div>

        <ul className="space-y-2 mb-6">
          {[
            '10 Mock Interviews per month',
            '10 Guidance Sessions per month',
            'Auto-matched with best interviewer',
            'Detailed feedback after each session',
            'Renews monthly — cancel anytime',
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <span className="text-green-300">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={handlePayment}
          disabled={paying}
          className="w-full bg-white text-indigo-700 font-bold py-3 px-6 rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-lg shadow"
        >
          {paying ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : (
            `Pay ₹99 — ${isFreePlan ? 'Unlock Pro' : 'Renew Plan'}`
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="text-center text-xs text-slate-400 mt-4">
        Secured by Razorpay · UPI, Cards, Net Banking accepted
      </p>
    </div>
  );
}

// ── Compact usage bar (shown inside booking pages when NOT at limit) ──────────
interface UsageBannerProps {
  planType: 'FREE' | 'PRO';
  used: number;
  limit: number;
  sessionType: 'interview' | 'guidance';
  planExpiresAt?: string | null;
}

export function UsageBanner({ planType, used, limit, sessionType, planExpiresAt }: UsageBannerProps) {
  const remaining = limit - used;
  const pct = Math.min((used / limit) * 100, 100);
  const sessionLabel = sessionType === 'interview' ? 'interviews' : 'guidance sessions';
  const isLow = remaining <= 1;

  const expiryStr = planExpiresAt
    ? new Date(planExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className={`rounded-xl p-4 mb-6 border ${
      isLow
        ? 'bg-amber-50 border-amber-200'
        : planType === 'PRO'
        ? 'bg-indigo-50 border-indigo-200'
        : 'bg-slate-50 border-slate-200'
    }`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            planType === 'PRO'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-200 text-slate-700'
          }`}>
            {planType === 'PRO' ? '⭐ Pro' : 'Free'}
          </span>
          <span className="text-sm text-slate-700">
            <strong>{remaining}</strong> {sessionLabel} remaining
          </span>
        </div>
        <span className="text-xs text-slate-500">{used}/{limit} used</span>
      </div>
      <div className="w-full bg-white rounded-full h-2 border border-slate-200">
        <div
          className={`h-2 rounded-full transition-all ${
            isLow ? 'bg-amber-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isLow && remaining > 0 && (
        <p className="text-xs text-amber-700 mt-2">
          ⚠️ Only {remaining} {sessionLabel} left.{' '}
          {planType === 'FREE' ? 'Upgrade to Pro for ₹99/month.' : 'Consider renewing soon.'}
        </p>
      )}
      {planType === 'PRO' && expiryStr && (
        <p className="text-xs text-indigo-600 mt-1">Plan renews on {expiryStr}</p>
      )}
    </div>
  );
}