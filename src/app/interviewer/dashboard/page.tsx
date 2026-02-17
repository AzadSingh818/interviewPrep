'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function InterviewerDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    education: '',
    companies: '',
    yearsOfExperience: '',
    rolesSupported: '',
    difficultyLevels: [] as string[],
    sessionTypesOffered: [] as string[],
    linkedinUrl: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/interviewer/profile');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.profile) {
          setProfile(data.profile);
          setFormData({
            name: data.profile.name || '',
            education: data.profile.education || '',
            companies: data.profile.companies?.join(', ') || '',
            yearsOfExperience: data.profile.yearsOfExperience?.toString() || '',
            rolesSupported: data.profile.rolesSupported?.join(', ') || '',
            difficultyLevels: data.profile.difficultyLevels || [],
            sessionTypesOffered: data.profile.sessionTypesOffered || [],
            linkedinUrl: data.profile.linkedinUrl || '',
          });
        } else {
          setEditing(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/interviewer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companies: formData.companies.split(',').map(c => c.trim()).filter(Boolean),
          rolesSupported: formData.rolesSupported.split(',').map(r => r.trim()).filter(Boolean),
        }),
      });

      if (res.ok) {
        await fetchProfile();
        setEditing(false);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const toggleDifficulty = (level: string) => {
    setFormData(prev => ({
      ...prev,
      difficultyLevels: prev.difficultyLevels.includes(level)
        ? prev.difficultyLevels.filter(l => l !== level)
        : [...prev.difficultyLevels, level],
    }));
  };

  const toggleSessionType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      sessionTypesOffered: prev.sessionTypesOffered.includes(type)
        ? prev.sessionTypesOffered.filter(t => t !== type)
        : [...prev.sessionTypesOffered, type],
    }));
  };

  const displayName = profile?.name || user?.name || user?.email?.split('@')[0] || 'Interviewer';
  const userInitials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  // ─── PENDING STATE ───────────────────────────────────────────────────────────
  if (profile?.status === 'PENDING') {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <ProfileHeader user={user} displayName={displayName} userInitials={userInitials} />

        <Card variant="elevated" className="p-8 text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-display font-bold text-slate-900 mb-2">
            Profile Under Review
          </h1>
          <p className="text-slate-600">
            Your profile is pending admin approval. You'll be notified once approved.
          </p>
        </Card>
      </div>
    );
  }

  // ─── REJECTED STATE ──────────────────────────────────────────────────────────
  if (profile?.status === 'REJECTED') {
    return (
      <div className="max-w-4xl mx-auto">
        <ProfileHeader user={user} displayName={displayName} userInitials={userInitials} />

        <Card variant="elevated" className="p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-display font-bold text-slate-900 mb-2">
            Profile Not Approved
          </h1>
          <p className="text-slate-600">
            Your profile was not approved. Please contact support for more information.
          </p>
        </Card>
      </div>
    );
  }

  // ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">

      {/* ✅ Profile Header - Same style as student dashboard */}
      <div className="flex items-center gap-6 mb-8">
        {/* Profile Picture */}
        <div className="relative">
          {user?.profilePicture ? (
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg ring-2 ring-violet-100">
              <Image
                src={user.profilePicture}
                alt={displayName}
                width={96}
                height={96}
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-2 ring-violet-100">
              {userInitials}
            </div>
          )}
          {user?.provider === 'GOOGLE' && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
          )}
        </div>

        {/* Welcome Text */}
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">
            Welcome back, {displayName}!
          </h1>
          <p className="text-slate-600 mt-1">{user?.email}</p>
          {user?.provider === 'GOOGLE' && (
            <p className="text-sm text-violet-600 mt-1 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Signed in with Google
            </p>
          )}
          {profile && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
              profile.status === 'APPROVED'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {profile.status === 'APPROVED' ? '✅ Approved Interviewer' : `⏳ ${profile.status}`}
            </span>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <Card variant="elevated" className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-display font-semibold text-slate-900">
            Your Profile
          </h2>
          {profile && !editing && (
            <Button onClick={() => setEditing(true)} variant="secondary" size="sm">
              Edit Profile
            </Button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Education"
                value={formData.education}
                onChange={(e) => setFormData({ ...formData, education: e.target.value })}
              />
              <Input
                label="Companies (comma-separated)"
                value={formData.companies}
                onChange={(e) => setFormData({ ...formData, companies: e.target.value })}
                placeholder="Google, Microsoft, Amazon"
              />
              <Input
                label="Years of Experience"
                type="number"
                value={formData.yearsOfExperience}
                onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
              />
            </div>

            <Input
              label="Roles Supported (comma-separated)"
              value={formData.rolesSupported}
              onChange={(e) => setFormData({ ...formData, rolesSupported: e.target.value })}
              placeholder="Software Engineer, Product Manager"
              required
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Difficulty Levels
              </label>
              <div className="flex gap-3">
                {['EASY', 'MEDIUM', 'HARD'].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleDifficulty(level)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      formData.difficultyLevels.includes(level)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Session Types Offered
              </label>
              <div className="flex gap-3">
                {['GUIDANCE', 'INTERVIEW'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleSessionType(type)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      formData.sessionTypesOffered.includes(type)
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-violet-400'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="LinkedIn URL"
              value={formData.linkedinUrl}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
              placeholder="https://linkedin.com/in/yourprofile"
            />

            <div className="flex gap-3">
              <Button type="submit">Save Profile</Button>
              {profile && (
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : profile ? (
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-slate-500 mb-1">Companies</p>
              <p className="font-medium text-slate-900">
                {profile.companies?.join(', ') || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Experience</p>
              <p className="font-medium text-slate-900">
                {profile.yearsOfExperience ? `${profile.yearsOfExperience} years` : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Roles Supported</p>
              <p className="font-medium text-slate-900">
                {profile.rolesSupported?.join(', ') || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Difficulty Levels</p>
              <p className="font-medium text-slate-900">
                {profile.difficultyLevels?.join(', ') || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Session Types</p>
              <p className="font-medium text-slate-900">
                {profile.sessionTypesOffered?.join(', ') || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Status</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                profile.status === 'APPROVED'
                  ? 'bg-green-100 text-green-800'
                  : profile.status === 'REJECTED'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {profile.status}
              </span>
            </div>
            {profile.education && (
              <div>
                <p className="text-sm text-slate-500 mb-1">Education</p>
                <p className="font-medium text-slate-900">{profile.education}</p>
              </div>
            )}
            {profile.linkedinUrl && (
              <div>
                <p className="text-sm text-slate-500 mb-1">LinkedIn</p>
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-violet-600 hover:text-violet-700 underline"
                >
                  View Profile
                </a>
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

// ─── Reusable Profile Header for PENDING/REJECTED states ─────────────────────
function ProfileHeader({
  user,
  displayName,
  userInitials,
}: {
  user: any;
  displayName: string;
  userInitials: string;
}) {
  return (
    <div className="flex items-center gap-6 mb-8">
      <div className="relative">
        {user?.profilePicture ? (
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg ring-2 ring-violet-100">
            <Image
              src={user.profilePicture}
              alt={displayName}
              width={96}
              height={96}
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-2 ring-violet-100">
            {userInitials}
          </div>
        )}
        {user?.provider === 'GOOGLE' && (
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
        )}
      </div>
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">
          Welcome back, {displayName}!
        </h1>
        <p className="text-slate-600 mt-1">{user?.email}</p>
        {user?.provider === 'GOOGLE' && (
          <p className="text-sm text-violet-600 mt-1 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Signed in with Google
          </p>
        )}
      </div>
    </div>
  );
}