'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function InterviewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/interviewer/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login/interviewer');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const displayName = profile?.name || user?.name || user?.email?.split('@')[0] || 'Interviewer';
  const userInitials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const navItems = [
    { href: '/interviewer/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/interviewer/availability', label: 'Availability', icon: '📅' },
    { href: '/interviewer/sessions', label: 'Sessions', icon: '💼' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/interviewer/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl" />
              <span className="text-2xl font-display font-bold text-slate-900">
                InterviewPrep<span className="text-indigo-600">Live</span>
              </span>
            </Link>

            {/* User Info */}
            <div className="flex items-center gap-4">
              {/* User Name & Email */}
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>

              {/* Profile Picture */}
              <div className="relative">
                {user?.profilePicture ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-violet-100 ring-2 ring-white">
                    <Image
                      src={user.profilePicture}
                      alt={displayName}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold border-2 border-violet-100 ring-2 ring-white">
                    {userInitials}
                  </div>
                )}
                {user?.provider === 'GOOGLE' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Logout Button */}
              <Button onClick={handleLogout} variant="ghost" size="sm">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-73px)] p-6">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  pathname === item.href
                    ? 'bg-violet-50 text-violet-600 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Page Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}