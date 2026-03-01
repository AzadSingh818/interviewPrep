'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: '🎯',
      title: 'Live 1-to-1 Sessions',
      desc: 'Real-time video interviews with industry experts from top companies like Google, Amazon, and Microsoft.',
    },
    {
      icon: '📊',
      title: 'Detailed Feedback',
      desc: 'Receive structured ratings on technical depth, problem solving, and communication after every session.',
    },
    {
      icon: '🤖',
      title: 'Smart Matching',
      desc: 'Our algorithm auto-assigns the best-fit interviewer based on your target role and experience level.',
    },
    {
      icon: '📅',
      title: 'Flexible Scheduling',
      desc: 'Book sessions at your convenience. Interviewers publish availability slots you can pick from.',
    },
    {
      icon: '🎓',
      title: 'Guidance Sessions',
      desc: 'Not ready for a full mock interview? Get personalized career guidance from experienced professionals.',
    },
    {
      icon: '🔒',
      title: 'Verified Interviewers',
      desc: 'Every interviewer is vetted by our admin team. Credentials and documents are verified before approval.',
    },
  ];

  const steps = [
    { step: '01', title: 'Create Profile', desc: 'Sign up as a student and fill in your target role, experience, and college details.' },
    { step: '02', title: 'Book a Session', desc: 'Choose guidance or mock interview. Our system finds the best interviewer for you.' },
    { step: '03', title: 'Attend Live', desc: 'Join the video call at the scheduled time. Conduct a real-world practice interview.' },
    { step: '04', title: 'Get Feedback', desc: 'Receive a detailed scorecard with hiring recommendation and improvement tips.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 text-white">

      {/* ── Navigation ── */}
      <nav className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl" />
            <span className="text-lg sm:text-2xl font-bold text-white">
              InterviewPrep<span className="text-indigo-400">Live</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-2 items-center">
            <Link href="/login/student">
              <button className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                Student Login
              </button>
            </Link>
            <Link href="/login/interviewer">
              <button className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                Interviewer Login
              </button>
            </Link>
            <Link href="/login/admin">
              <button className="px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/30 rounded-xl transition-all">
                🛡️ Admin
              </button>
            </Link>
            <Link href="/signup/student">
              <button className="ml-2 px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all">
                Get Started
              </button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-sm px-4 py-4 flex flex-col gap-2">
            <Link href="/login/student" onClick={() => setMobileMenuOpen(false)}>
              <button className="w-full text-left px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                🎓 Student Login
              </button>
            </Link>
            <Link href="/login/interviewer" onClick={() => setMobileMenuOpen(false)}>
              <button className="w-full text-left px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                👔 Interviewer Login
              </button>
            </Link>
            <Link href="/login/admin" onClick={() => setMobileMenuOpen(false)}>
              <button className="w-full text-left px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all">
                🛡️ Admin Login
              </button>
            </Link>
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
              <Link href="/signup/student" onClick={() => setMobileMenuOpen(false)}>
                <button className="w-full px-4 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all">
                  Sign Up Free
                </button>
              </Link>
              <Link href="/signup/interviewer" onClick={() => setMobileMenuOpen(false)}>
                <button className="w-full px-4 py-2.5 text-sm font-semibold border border-white/20 text-white hover:bg-white/10 rounded-xl transition-all">
                  Be Interviewer
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-32">
        <div className="text-center max-w-4xl mx-auto">

          <div className="inline-block mb-6 px-4 py-2 bg-indigo-500/20 border border-indigo-400/30 rounded-full">
            <span className="text-indigo-300 text-sm font-medium">
              🎯 Live 1-to-1 Interview Preparation
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Master Your Next
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Interview
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-300 mb-10 sm:mb-12 leading-relaxed max-w-2xl mx-auto">
            Connect with industry experts for personalized guidance sessions and realistic
            mock interviews. Get detailed feedback and level up your interview skills.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/signup/student">
              <button className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50">
                Get Started as Student →
              </button>
            </Link>
            <Link href="/signup/interviewer">
              <button className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-all">
                Join as Interviewer
              </button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-bold text-lg">500+</span>
              <span>Practice Sessions</span>
            </div>
            <div className="w-px h-5 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-violet-400 font-bold text-lg">50+</span>
              <span>Expert Interviewers</span>
            </div>
            <div className="w-px h-5 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold text-lg">4.9★</span>
              <span>Average Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-white/5 border-t border-b border-white/10 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">Everything You Need to Succeed</h2>
            <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
              A complete interview prep ecosystem built for serious candidates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map(f => (
              <div key={f.title} className="p-5 sm:p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-400/40 hover:bg-white/8 transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-slate-400 text-base sm:text-lg">From signup to offer letter — we're with you every step.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.step} className="relative text-center">
                {/* connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-full h-px bg-gradient-to-r from-indigo-500/50 to-transparent" />
                )}
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-indigo-500/30">
                  {s.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Interviewers ── */}
      <section className="bg-white/5 border-t border-white/10 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-block mb-4 px-3 py-1 bg-violet-500/20 border border-violet-400/30 rounded-full text-violet-300 text-sm font-medium">
                👔 For Interviewers
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
                Share Your Expertise.<br />Make an Impact.
              </h2>
              <p className="text-slate-400 text-base sm:text-lg mb-6 leading-relaxed">
                Are you a working professional at a top tech company? Help the next generation of engineers
                and data scientists crack their dream interviews. Set your own schedule, get verified, and start mentoring.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link href="/signup/interviewer">
                  <button className="w-full sm:w-auto px-8 py-3 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all">
                    Apply as Interviewer
                  </button>
                </Link>
                <Link href="/login/interviewer">
                  <button className="w-full sm:w-auto px-8 py-3 text-sm font-semibold border border-white/20 text-white hover:bg-white/10 rounded-xl transition-all">
                    Already joined? Sign in
                  </button>
                </Link>
              </div>
            </div>

            <div className="w-full lg:w-auto grid grid-cols-2 gap-4">
              {[
                { icon: '🏆', label: 'Top Companies', value: 'Google, Amazon, Meta, Microsoft' },
                { icon: '⏰', label: 'Flexible Hours', value: 'Set your own availability' },
                { icon: '📋', label: 'Structured Format', value: 'Guided feedback template' },
                { icon: '✅', label: 'Verified Profile', value: 'Build your mentor brand' },
              ].map(item => (
                <div key={item.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                  <p className="text-sm font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
            Ready to Land Your Dream Job?
          </h2>
          <p className="text-slate-400 text-base sm:text-lg mb-8">
            Join hundreds of students who've already cracked interviews at top companies.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup/student">
              <button className="w-full sm:w-auto px-8 py-4 text-base font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl transition-all shadow-xl shadow-indigo-500/30">
                Start for Free →
              </button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">No credit card required · Free plan available</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg" />
            <span className="font-semibold text-white/60">InterviewPrep<span className="text-indigo-400">Live</span></span>
          </div>
          <p>© {new Date().getFullYear()} InterviewPrepLive. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/login/student" className="hover:text-white transition-colors">Students</Link>
            <Link href="/signup/interviewer" className="hover:text-white transition-colors">Interviewers</Link>
            <Link href="/login/admin" className="hover:text-white transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}