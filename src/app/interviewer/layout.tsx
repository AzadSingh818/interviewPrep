'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

// ─── Dark Mode Hook ───────────────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
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
  const [tab, setTab] = useState<'profile' | 'appearance' | 'password'>('profile');

  // Password state
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Edit profile state — interviewer fields
  const [profileForm, setProfileForm] = useState({
    name:              '',
    education:         '',
    companies:         '',
    yearsOfExperience: '',
    rolesSupported:    '',
    linkedinUrl:       '',
  });
  const [profileStatus, setProfileStatus]   = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const isGoogle = user?.provider === 'GOOGLE';

  // Sync form when modal opens
  useEffect(() => {
    if (open && profile) {
      setProfileForm({
        name:              profile.name              || '',
        education:         profile.education         || '',
        companies:         profile.companies?.join(', ') || '',
        yearsOfExperience: profile.yearsOfExperience?.toString() || '',
        rolesSupported:    profile.rolesSupported?.join(', ') || '',
        linkedinUrl:       profile.linkedinUrl       || '',
      });
    }
    if (!open) {
      setPwStatus(null);
      setProfileStatus(null);
      setPwForm({ current: '', next: '', confirm: '' });
    }
  }, [open, profile]);

  // ── Password change ──────────────────────────────────────────────────────
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);
    if (pwForm.next !== pwForm.confirm) { setPwStatus({ type: 'error', msg: 'New passwords do not match' }); return; }
    if (pwForm.next.length < 8)         { setPwStatus({ type: 'error', msg: 'Password must be at least 8 characters' }); return; }
    setPwLoading(true);
    try {
      const res = await fetch('/api/interviewer/change-password', {
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

  // ── Profile save ─────────────────────────────────────────────────────────
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus(null);
    setProfileLoading(true);
    try {
      const res = await fetch('/api/interviewer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profileForm,
          companies:      profileForm.companies.split(',').map(c => c.trim()).filter(Boolean),
          rolesSupported: profileForm.rolesSupported.split(',').map(r => r.trim()).filter(Boolean),
          // Keep existing array fields unchanged (managed on dashboard page)
          difficultyLevels:      profile?.difficultyLevels      || [],
          sessionTypesOffered:   profile?.sessionTypesOffered   || [],
          interviewTypesOffered: profile?.interviewTypesOffered || [],
        }),
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

  const inputCls  = 'w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none transition-colors text-sm';
  const labelCls  = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide';

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
            { key: 'appearance', label: '🎨 Appearance'   },
            { key: 'password',   label: '🔐 Password'     },
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

        {/* Scrollable body */}
        <div className="px-6 py-5 overflow-y-auto">

          {/* ── Edit Profile Tab ── */}
          {tab === 'profile' && (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Update your interviewer profile details.
              </p>

              <div>
                <label className={labelCls}>Full Name</label>
                <input
                  className={inputCls}
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Education</label>
                <input
                  className={inputCls}
                  value={profileForm.education}
                  onChange={e => setProfileForm({ ...profileForm, education: e.target.value })}
                  placeholder="e.g. B.Tech from IIT Delhi"
                />
              </div>

              <div>
                <label className={labelCls}>Companies (comma-separated)</label>
                <input
                  className={inputCls}
                  value={profileForm.companies}
                  onChange={e => setProfileForm({ ...profileForm, companies: e.target.value })}
                  placeholder="e.g. Google, Amazon, Microsoft"
                />
              </div>

              <div>
                <label className={labelCls}>Years of Experience</label>
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={profileForm.yearsOfExperience}
                  onChange={e => setProfileForm({ ...profileForm, yearsOfExperience: e.target.value })}
                  placeholder="e.g. 5"
                />
              </div>

              <div>
                <label className={labelCls}>Roles Supported (comma-separated)</label>
                <input
                  className={inputCls}
                  value={profileForm.rolesSupported}
                  onChange={e => setProfileForm({ ...profileForm, rolesSupported: e.target.value })}
                  placeholder="e.g. SDE, Data Scientist, PM"
                />
              </div>

              <div>
                <label className={labelCls}>LinkedIn URL</label>
                <input
                  className={inputCls}
                  type="url"
                  value={profileForm.linkedinUrl}
                  onChange={e => setProfileForm({ ...profileForm, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>

              {profileStatus && (
                <div className={`text-sm px-3 py-2 rounded-lg ${
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
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400">
                  🔒 Your account uses Google sign-in. Password management is handled by Google.
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Update your login password. Must be at least 8 characters.
                  </p>
                  <div>
                    <label className={labelCls}>Current Password</label>
                    <input
                      className={inputCls}
                      type="password"
                      value={pwForm.current}
                      onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                      required
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>New Password</label>
                    <input
                      className={inputCls}
                      type="password"
                      value={pwForm.next}
                      onChange={e => setPwForm({ ...pwForm, next: e.target.value })}
                      required
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm New Password</label>
                    <input
                      className={inputCls}
                      type="password"
                      value={pwForm.confirm}
                      onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                      required
                      placeholder="••••••••"
                    />
                  </div>

                  {pwStatus && (
                    <div className={`text-sm px-3 py-2 rounded-lg ${
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
export default function InterviewerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 🚀 CRITICAL: Interview room gets NO shell
  if (pathname?.includes('/interview-room')) {
    return <>{children}</>;
  }

  const router = useRouter();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [user, setUser]                 = useState<any>(null);
  const [profile, setProfile]           = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  useEffect(() => { fetchUser(); }, []);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/interviewer/profile');
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
      router.push('/login/interviewer');
    } catch (err) { console.error('Logout failed:', err); }
  };

  const displayName  = profile?.name || user?.name || user?.email?.split('@')[0] || 'Interviewer';
  const userInitials = displayName.split(' ').map((n: string) => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);

  const profileComplete = !!(profile?.name && profile?.companies?.length && profile?.rolesSupported?.length);

  const navigation = [
    { name: 'Dashboard',    href: '/interviewer/dashboard',    icon: '📊' },
    { name: 'Availability', href: '/interviewer/availability', icon: '📅' },
    { name: 'Sessions',     href: '/interviewer/sessions',     icon: '💼' },
  ];

  // Icon-strip items (same order as nav + settings)
  const iconStripItems = [
    ...navigation.map(n => ({ ...n, isSettings: false })),
    { name: 'Settings', href: '', icon: '⚙️', isSettings: true },
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-gray-950 dark:via-gray-900 dark:to-violet-950 transition-colors duration-200">

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
      <div className="fixed top-0 left-0 h-full w-14 bg-white dark:bg-gray-900 border-r border-slate-100 dark:border-gray-800 flex flex-col items-center py-3 z-50 shrink-0">

        {/* Expand icon */}
        <button
          onClick={() => setSidebarOpen(true)}
          title="Open sidebar"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        {/* Nav icons */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {iconStripItems.map(item => {
            const isActive   = !item.isSettings && pathname === item.href;
            const isSettings = item.isSettings;
            const btn = (
              <button
                key={item.name}
                title={item.name}
                onClick={() => { if (isSettings) { setSettingsOpen(true); } }}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-base
                  ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-gray-500 hover:text-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800'}`}
              >
                {item.icon}
              </button>
            );
            if (isSettings) return btn;
            return (
              <Link key={item.href} href={item.href} title={item.name}>
                <div className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-base
                  ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-gray-500 hover:text-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800'}`}>
                  {item.icon}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom: logout + avatar */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <button
            onClick={handleLogout}
            title="Logout"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
          <button
            onClick={() => setSidebarOpen(true)}
            title={displayName}
            className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-slate-200 dark:ring-gray-700 hover:ring-indigo-400 transition-all"
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
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white dark:bg-gray-900 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* ── Logo ── */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-800">
          <Link href="/interviewer/dashboard" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg shrink-0" />
            <span className="text-[15px] font-bold text-slate-900 dark:text-white">
              InterviewPrep<span className="text-indigo-600">Live</span>
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* ── Nav ── */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {navigation.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[13.5px] font-medium group mb-0.5
                  ${isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <span className="shrink-0">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}

          {/* Settings button */}
          <button
            onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[13.5px] font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white group"
          >
            <span className="shrink-0">⚙️</span>
            Settings
          </button>

          <div className="my-3 border-t border-slate-100 dark:border-gray-800" />

          {/* Status badge */}
          {profile && (
            <div className="px-3 py-2 mb-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${
                profile.status === 'APPROVED'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : profile.status === 'PENDING'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {profile.status === 'APPROVED' ? '✅ Approved' : profile.status === 'PENDING' ? '⏳ Pending Review' : '❌ Rejected'}
              </span>
            </div>
          )}

          {/* Incomplete profile warning */}
          {!profileComplete && (
            <div className="mx-1 mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1.5">⚠️ Complete your profile</p>
              <button
                onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }}
                className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg transition-colors"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>

        {/* ── Bottom: User info ── */}
        <div className="shrink-0 border-t border-slate-100 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {user?.profilePicture ? (
                <Image src={user.profilePicture} alt={displayName} width={36} height={36} className="rounded-full object-cover border-2 border-indigo-100 ring-2 ring-white dark:ring-gray-900" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
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
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
              <p className="text-[11px] text-slate-500 dark:text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <main className="flex-1 ml-14 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-slate-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
            {/* Logo — visible at top always */}
            <Link href="/interviewer/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg" />
              <span className="text-[15px] font-bold text-slate-900 dark:text-white hidden sm:block">
                InterviewPrep<span className="text-indigo-600">Live</span>
              </span>
            </Link>

            {/* Right: name + avatar */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{displayName}</p>
                <p className="text-xs text-slate-500 dark:text-gray-500">{user?.email}</p>
              </div>
              <div className="relative">
                {user?.profilePicture ? (
                  <Image
                    src={user.profilePicture}
                    alt={displayName}
                    width={36}
                    height={36}
                    className="rounded-full object-cover border-2 border-indigo-100"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
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
        </header>

        <div className="p-6 flex-1">{children}</div>
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