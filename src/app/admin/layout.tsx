'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/');
  };

  const navItems = [
    { href: '/admin/dashboard',    label: 'Dashboard',    icon: '📊' },
    { href: '/admin/interviewers', label: 'Interviewers', icon: '👥' },
    { href: '/admin/analytics',    label: 'Analytics',    icon: '📈' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col">

      {/* ── Top Nav ── */}
      <nav className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">

          {/* Logo */}
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl" />
            <span className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
              InterviewPrep<span className="text-indigo-600">Live</span>
            </span>
            <span className="ml-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full hidden sm:inline">
              ADMIN
            </span>
          </Link>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">🛡️ Admin Panel</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">Full access</p>
            </div>
            <button onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-slate-200 dark:border-gray-700">
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <button onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              Logout
            </button>
            <button onClick={() => setMobileMenuOpen(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition-all">
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex flex-col gap-1">
            {navItems.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium
                  ${pathname === item.href ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800'}`}>
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-56 lg:w-64 bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800 flex-col p-4 lg:p-6 shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl transition-all text-sm font-medium
                  ${pathname === item.href ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white'}`}>
                <span className="text-lg lg:text-xl">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-100 dark:border-gray-800">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-0.5">🛡️ Admin Access</p>
              <p className="text-[11px] text-red-500 dark:text-red-500">Full platform control</p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}