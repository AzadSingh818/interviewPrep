'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Close drawer on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const handleLogout = () => {
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/');
  };

  const navItems = [
    { href: '/admin/dashboard',    label: 'Dashboard',    icon: '📊' },
    { href: '/admin/interviewers', label: 'Interviewers', icon: '👥' },
    { href: '/admin/analytics',    label: 'Analytics',    icon: '📈' },
    { href: '/admin/config',       label: 'Config',       icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col">

      {/* ══════════════════════════════════════════
          TOP NAV BAR
      ══════════════════════════════════════════ */}
      <nav className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="px-4 sm:px-6 py-3 flex justify-between items-center">

          {/* Left: hamburger (mobile) + collapse toggle (desktop) + logo */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition-all"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>

            {/* Desktop collapse toggle */}
            <button
              onClick={() => setCollapsed(v => !v)}
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition-all"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {collapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
                )}
              </svg>
            </button>

            <Link href="/admin/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl" />
              <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                InterviewPrep<span className="text-indigo-600">Live</span>
              </span>
              <span className="ml-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full hidden sm:inline">
                ADMIN
              </span>
            </Link>
          </div>

          {/* Right: admin info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">🛡️ Admin Panel</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">Full access</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-slate-200 dark:border-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          BODY = SIDEBAR + MAIN
      ══════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 relative">

        {/* ── Mobile backdrop overlay ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ══════════════════════════════════════════
            SIDEBAR
            • Mobile: off-canvas drawer (slides in from left)
            • Desktop: sticky, collapsible (full ↔ icon-only)
        ══════════════════════════════════════════ */}
        <aside
          className={`
            fixed md:sticky top-0 md:top-[57px] left-0 h-full md:h-[calc(100vh-57px)]
            bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800
            flex flex-col z-50
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
            ${collapsed ? 'md:w-[72px]' : 'md:w-64'}
          `}
        >
          {/* Mobile close button */}
          <div className="md:hidden flex items-center justify-between px-4 py-4 border-b border-slate-100 dark:border-gray-800">
            <span className="text-sm font-semibold text-slate-700 dark:text-white">Navigation</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium
                    ${isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white'
                    }
                    ${collapsed ? 'md:justify-center md:px-0' : ''}
                  `}
                >
                  <span className="text-xl shrink-0">{item.icon}</span>
                  <span className={`transition-all duration-200 ${collapsed ? 'md:hidden' : ''}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Footer badge */}
          <div className={`p-3 border-t border-slate-100 dark:border-gray-800 ${collapsed ? 'md:flex md:justify-center' : ''}`}>
            {collapsed ? (
              <div className="hidden md:flex w-9 h-9 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-lg" title="Admin Access">
                🛡️
              </div>
            ) : null}
            <div className={`p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl ${collapsed ? 'md:hidden' : ''}`}>
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-0.5">🛡️ Admin Access</p>
              <p className="text-[11px] text-red-500 dark:text-red-500">Full platform control</p>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}