'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

// ─── Dark mode hook ───────────────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const enabled = saved === 'dark' || (!saved && prefersDark);
    setDark(enabled);
    document.documentElement.classList.toggle('dark', enabled);
  }, []);

  const toggle = () => {
    setDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return { dark, toggle };
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({
  open,
  onClose,
  user,
  profile,
  dark,
  onToggleDark,
  onProfileSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: any;
  profile: any;
  dark: boolean;
  onToggleDark: () => void;
  onProfileSaved: () => void;
}) {
  const [tab, setTab] = useState<'appearance' | 'profile' | 'password'>('profile');

  // Password state
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Edit profile state
  const [profileForm, setProfileForm] = useState({
    name: '', college: '', branch: '', graduationYear: '', targetRole: '', experienceLevel: '',
  });
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const isGoogle = user?.provider === 'GOOGLE';

  // Sync profile form when modal opens
  useEffect(() => {
    if (open && profile) {
      setProfileForm({
        name:            profile.name             || '',
        college:         profile.college          || '',
        branch:          profile.branch           || '',
        graduationYear:  profile.graduationYear?.toString() || '',
        targetRole:      profile.targetRole       || '',
        experienceLevel: profile.experienceLevel  || '',
      });
    }
    if (!open) {
      setPwStatus(null);
      setProfileStatus(null);
      setPwForm({ current: '', next: '', confirm: '' });
    }
  }, [open, profile]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);
    if (pwForm.next !== pwForm.confirm) { setPwStatus({ type: 'error', msg: 'New passwords do not match' }); return; }
    if (pwForm.next.length < 8)         { setPwStatus({ type: 'error', msg: 'Password must be at least 8 characters' }); return; }
    setPwLoading(true);
    try {
      const res = await fetch('/api/student/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwStatus({ type: 'success', msg: 'Password updated successfully!' });
        setPwForm({ current: '', next: '', confirm: '' });
      } else {
        setPwStatus({ type: 'error', msg: data.error || 'Failed to update password' });
      }
    } catch {
      setPwStatus({ type: 'error', msg: 'Something went wrong. Please try again.' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus(null);
    setProfileLoading(true);
    try {
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      if (res.ok) {
        setProfileStatus({ type: 'success', msg: 'Profile updated!' });
        onProfileSaved();
      } else {
        const d = await res.json();
        setProfileStatus({ type: 'error', msg: d.error || 'Failed to save profile' });
      }
    } catch {
      setProfileStatus({ type: 'error', msg: 'Something went wrong.' });
    } finally {
      setProfileLoading(false);
    }
  };

  if (!open) return null;

  const inputCls = "w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none transition-colors text-sm";
  const labelCls = "block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-800 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">⚙️ Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-gray-800 shrink-0">
          {([
            { key: 'profile',    label: '👤 Edit Profile' },
            { key: 'appearance', label: '🎨 Appearance' },
            { key: 'password',   label: '🔐 Password' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPwStatus(null); setProfileStatus(null); }}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                tab === t.key
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="px-6 py-5 overflow-y-auto">

          {/* ── Edit Profile Tab (default/first) ── */}
          {tab === 'profile' && (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Update your profile details.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input className={inputCls} value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Your name" required />
                </div>
                <div>
                  <label className={labelCls}>College</label>
                  <input className={inputCls} value={profileForm.college} onChange={e => setProfileForm({ ...profileForm, college: e.target.value })} placeholder="College name" />
                </div>
                <div>
                  <label className={labelCls}>Branch / Major</label>
                  <input className={inputCls} value={profileForm.branch} onChange={e => setProfileForm({ ...profileForm, branch: e.target.value })} placeholder="e.g. CSE" />
                </div>
                <div>
                  <label className={labelCls}>Graduation Year</label>
                  <input className={inputCls} type="number" value={profileForm.graduationYear} onChange={e => setProfileForm({ ...profileForm, graduationYear: e.target.value })} placeholder="e.g. 2026" />
                </div>
                <div>
                  <label className={labelCls}>Target Role</label>
                  <input className={inputCls} value={profileForm.targetRole} onChange={e => setProfileForm({ ...profileForm, targetRole: e.target.value })} placeholder="e.g. SDE" />
                </div>
                <div>
                  <label className={labelCls}>Experience Level</label>
                  <input className={inputCls} value={profileForm.experienceLevel} onChange={e => setProfileForm({ ...profileForm, experienceLevel: e.target.value })} placeholder="e.g. Entry Level" />
                </div>
              </div>

              {profileStatus && (
                <div className={`p-3 rounded-lg text-sm font-medium ${
                  profileStatus.type === 'success'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {profileStatus.type === 'success' ? '✅ ' : '❌ '}{profileStatus.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {profileLoading ? 'Saving…' : 'Save Profile'}
              </button>
            </form>
          )}

          {/* ── Appearance Tab ── */}
          {tab === 'appearance' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose how InterviewPrep Live looks to you.
              </p>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{dark ? '🌙' : '☀️'}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {dark ? 'Dark Mode' : 'Light Mode'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {dark ? 'Easier on the eyes at night' : 'Best for bright environments'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onToggleDark}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${dark ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${dark ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {/* ── Password Tab ── */}
          {tab === 'password' && (
            <div>
              {isGoogle ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Signed in with Google</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your account uses Google sign-in. Password management is handled by Google.
                  </p>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    Update your account password.
                  </p>
                  <div>
                    <label className={labelCls}>Current Password</label>
                    <input type="password" className={inputCls} value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} required placeholder="Enter current password" />
                  </div>
                  <div>
                    <label className={labelCls}>New Password</label>
                    <input type="password" className={inputCls} value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} required placeholder="Min. 8 characters" />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm New Password</label>
                    <input type="password" className={inputCls} value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} required placeholder="Repeat new password" />
                  </div>

                  {pwStatus && (
                    <div className={`p-3 rounded-lg text-sm font-medium ${
                      pwStatus.type === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {pwStatus.type === 'success' ? '✅ ' : '❌ '}{pwStatus.msg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {pwLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Updating…
                      </span>
                    ) : 'Update Password'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 🚀 CRITICAL: Interview room gets NO shell
  if (pathname?.includes('/interview-room')) {
    return <>{children}</>;
  }

  const router = useRouter();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [user, setUser]           = useState<any>(null);
  const [profile, setProfile]     = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  useEffect(() => { fetchUser(); }, []);

  // Close sidebar whenever route changes
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/student/profile');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfile(data.profile);
      }
    } catch (err) { console.error('Failed to fetch user:', err); }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login/student');
    } catch (err) { console.error('Logout failed:', err); }
  };

  const displayName  = profile?.name || user?.name || user?.email?.split('@')[0] || 'Student';
  const userInitials = displayName.split(' ').map((n: string) => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);

  // "Setup Profile" CTA is hidden once all key fields are filled
  const profileComplete = !!(profile?.name && profile?.college && profile?.branch && profile?.targetRole && profile?.resumeUrl);
  const isPro           = profile?.planType === 'PRO';
  const interviewsLeft  = profile ? profile.interviewsLimit - profile.interviewsUsed : null;
  const guidanceLeft    = profile ? profile.guidanceLimit   - profile.guidanceUsed   : null;

  const navigation = [
    { name: 'Dashboard',      href: '/student/dashboard',      icon: '📊' },
    { name: 'Book Guidance',  href: '/student/book-guidance',  icon: '🎓' },
    { name: 'Book Interview', href: '/student/book-interview', icon: '💼' },
    { name: 'My Sessions',    href: '/student/sessions',       icon: '📅' },
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors duration-200">

      {/* ── Backdrop overlay (when sidebar is open) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════
          NARROW ICON STRIP — always visible on left
      ══════════════════════════════════════════════ */}
      <div className="fixed top-0 left-0 h-full w-14 bg-[white] flex flex-col items-center py-3 z-50 shrink-0">

        {/* Expand icon (top) */}
        <button
          onClick={() => setSidebarOpen(true)}
          title="Open sidebar"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        {/* Nav icons */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {[
            { href: '/student/dashboard', title: 'Dashboard', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/></svg>
            )},
            { href: '/student/book-guidance', title: 'Book Guidance', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
            )},
            { href: '/student/book-interview', title: 'Book Interview', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            )},
            { href: '/student/sessions', title: 'My Sessions', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            )},
            { href: '#settings', title: 'Settings', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            )},
          ].map(item => {
            const isActive = pathname === item.href;
            const isSettings = item.href === '#settings';
            const btn = (
              <button
                key={item.href}
                title={item.title}
                onClick={isSettings ? () => setSettingsOpen(true) : undefined}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                  ${isActive ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
              >
                {item.icon}
              </button>
            );
            if (isSettings) return btn;
            return (
              <Link key={item.href} href={item.href} title={item.title}>
                <div className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                  ${isActive ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}>
                  {item.icon}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom: avatar + logout */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Logout"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>

          {/* Avatar */}
          <button
            onClick={() => setSidebarOpen(true)}
            title={displayName}
            className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/10 hover:ring-indigo-400 transition-all"
          >
            {user?.profilePicture ? (
              <Image src={user.profilePicture} alt={displayName} width={36} height={36} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                {userInitials}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          FULL SIDEBAR DRAWER — slides in over strip
      ══════════════════════════════════════════════ */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-[white] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* ── Top: App name + close ── */}
        <div className="flex items-center justify-between px-4 py-4 shrink-0">
          <Link href="/student/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg shrink-0" />
            <span className="text-[15px] font-semibold text-black tracking-tight">
              InterviewPrep<span className="text-indigo-400">Live</span>
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* ── Navigation ── */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {[
            { name: 'Dashboard', href: '/student/dashboard', icon: (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/></svg>
            )},
            { name: 'Book Guidance', href: '/student/book-guidance', icon: (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
            )},
            { name: 'Book Interview', href: '/student/book-interview', icon: (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            )},
            { name: 'My Sessions', href: '/student/sessions', icon: (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            )},
          ].map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[13.5px] font-medium group
                  ${isActive ? 'bg-white/10 text-black' : 'text-gray-400 hover:bg-white/8 hover:text-black'}`}
              >
                <span className={`shrink-0 transition-colors ${isActive ? 'text-black' : 'text-gray-500 group-hover:text-gray-300'}`}>
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}

          {/* Settings */}
          <button
            onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[13.5px] font-medium text-gray-400 hover:bg-white/8 hover:text-white group"
          >
            <svg className="w-[18px] h-[18px] shrink-0 text-gray-500 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Settings
          </button>

          <div className="my-3 border-t border-white/8" />

          {/* Sessions left */}
          {profile && (
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2">Sessions Left</p>
              <div className="space-y-2">
                {interviewsLeft !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      Interviews
                    </span>
                    <span className={`text-[12px] font-bold ${interviewsLeft === 0 ? 'text-red-400' : interviewsLeft <= 1 ? 'text-amber-400' : 'text-indigo-400'}`}>
                      {interviewsLeft} left
                    </span>
                  </div>
                )}
                {guidanceLeft !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
                      Guidance
                    </span>
                    <span className={`text-[12px] font-bold ${guidanceLeft === 0 ? 'text-red-400' : guidanceLeft <= 1 ? 'text-amber-400' : 'text-violet-400'}`}>
                      {guidanceLeft} left
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upgrade / Pro CTA */}
          {!isPro ? (
            <div className="mx-1 mt-1 p-3 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-[13px] font-semibold text-white mb-0.5">Go Pro 🚀</p>
              <p className="text-[11px] text-gray-500 mb-2.5">Unlock 10 sessions/month</p>
              <Link href="/student/dashboard?upgrade=1">
                <button className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[12px] font-bold rounded-lg hover:opacity-90 transition-opacity">
                  Upgrade — ₹99/mo
                </button>
              </Link>
            </div>
          ) : (
            <div className="mx-1 mt-1 p-3 bg-white/5 border border-white/10 rounded-xl text-center">
              <p className="text-[13px] font-semibold text-indigo-400">⭐ Pro Plan Active</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Enjoy unlimited access</p>
            </div>
          )}

          {/* Incomplete profile warning */}
          {!profileComplete && (
            <div className="mx-1 mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-[11px] font-semibold text-amber-400 mb-1.5">⚠️ Complete your profile</p>
              <button
                onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }}
                className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg transition-colors"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>

        {/* ── Bottom: User profile ── */}
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {user?.profilePicture ? (
                <div className="w-8 h-8 rounded-full overflow-hidden">
                  <Image src={user.profilePicture} alt={displayName} width={32} height={32} className="object-cover" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                  {userInitials}
                </div>
              )}
              {user?.provider === 'GOOGLE' && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[white] rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-black truncate">{displayName}</p>
              <p className="text-[11px] text-green truncate">{isPro ? '⭐ Pro Plan' : 'Free Plan'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Page Content (offset by icon strip width) ── */}
      <main className="flex-1 pl-14 min-w-0 w-full">
        {/* Top bar inside content area */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-slate-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
          <Link href="/student/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg" />
            <span className="text-lg font-display font-bold text-slate-900 dark:text-white">
              InterviewPrep<span className="text-indigo-600">Live</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900 dark:text-black">{displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
            <div className="relative">
              {user?.profilePicture ? (
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-indigo-100 ring-2 ring-white dark:ring-gray-900">
                  <Image src={user.profilePicture} alt={displayName} width={36} height={36} className="object-cover" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-black text-sm font-bold">
                  {userInitials}
                </div>
              )}
              {user?.provider === 'GOOGLE' && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center shadow-sm">
                  <svg className="w-3 h-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        profile={profile}
        dark={dark}
        onToggleDark={toggleDark}
        onProfileSaved={() => {
          fetchUser();
          setSettingsOpen(false);
          window.dispatchEvent(new Event('profile-saved'));
        }}
      />
    </div>
  );
}