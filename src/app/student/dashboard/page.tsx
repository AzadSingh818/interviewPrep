'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { PaymentGate } from '@/components/shared/PaymentGate'; // ✅ ADDED
import Link from 'next/link';
import Image from 'next/image';

// ✅ ADDED: Subscription status card component
function SubscriptionCard({ profile, onUpgrade }: { profile: any; onUpgrade: () => void }) {
  if (!profile) return null;

  const isPro = profile.planType === 'PRO';
  const expiryStr = profile.planExpiresAt
    ? new Date(profile.planExpiresAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;

  const interviewPct = Math.min((profile.interviewsUsed / profile.interviewsLimit) * 100, 100);
  const guidancePct = Math.min((profile.guidanceUsed / profile.guidanceLimit) * 100, 100);

  return (
    <Card variant="elevated" className={`p-6 mb-8 ${isPro ? 'border-indigo-300 bg-gradient-to-r from-indigo-50 to-violet-50' : 'border-slate-200'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              isPro ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {isPro ? '⭐ Pro Plan' : '🆓 Free Plan'}
            </span>
            {isPro && expiryStr && (
              <span className="text-xs text-indigo-600">Expires {expiryStr}</span>
            )}
          </div>
          <p className="text-sm text-slate-600">
            {isPro
              ? '10 interviews + 10 guidance sessions per month'
              : '5 free interviews + 5 guidance sessions included'}
          </p>
        </div>
        {!isPro && (
          <button
            onClick={onUpgrade}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity shadow"
          >
            Upgrade — ₹99/mo
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>Mock Interviews</span>
            <span className="font-medium">{profile.interviewsUsed}/{profile.interviewsLimit}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                interviewPct >= 100 ? 'bg-red-500' : interviewPct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${interviewPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>Guidance Sessions</span>
            <span className="font-medium">{profile.guidanceUsed}/{profile.guidanceLimit}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                guidancePct >= 100 ? 'bg-red-500' : guidancePct >= 80 ? 'bg-amber-500' : 'bg-violet-500'
              }`}
              style={{ width: `${guidancePct}%` }}
            />
          </div>
        </div>
      </div>

      {(profile.interviewsUsed >= profile.interviewsLimit || profile.guidanceUsed >= profile.guidanceLimit) && (
        <p className="text-xs text-red-600 mt-3 font-medium">
          ⚠️ You've reached your limit.{' '}
          {isPro ? 'Renew your plan to continue booking.' : 'Upgrade to Pro to book more sessions.'}
        </p>
      )}
    </Card>
  );
}

export default function StudentDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false); // ✅ ADDED
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    college: '',
    branch: '',
    graduationYear: '',
    targetRole: '',
    experienceLevel: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profileRes, sessionsRes] = await Promise.all([
        fetch('/api/student/profile'),
        fetch('/api/student/sessions'),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setUser(data.user);
        setProfile(data.profile);
        if (data.profile) {
          setFormData({
            name: data.profile.name || '',
            college: data.profile.college || '',
            branch: data.profile.branch || '',
            graduationYear: data.profile.graduationYear?.toString() || '',
            targetRole: data.profile.targetRole || '',
            experienceLevel: data.profile.experienceLevel || '',
          });
        } else {
          setEditing(true);
        }
      }

      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await fetchData();
        setEditing(false);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setResumeError('Please upload a PDF, DOC, or DOCX file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setResumeError('File size must be less than 5MB');
      return;
    }

    setResumeError('');
    setUploadingResume(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const res = await fetch('/api/student/upload-resume', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await fetchData();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const data = await res.json();
        setResumeError(data.error || 'Failed to upload resume');
      }
    } catch (error) {
      console.error('Failed to upload resume:', error);
      setResumeError('Failed to upload resume');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!confirm('Are you sure you want to delete your resume?')) return;

    try {
      const res = await fetch('/api/student/upload-resume', {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to delete resume:', error);
    }
  };

  // ✅ ADDED: payment success handler
  const handlePaymentSuccess = () => {
    setShowUpgrade(false);
    fetchData();
  };

  const getResumeFileName = (url: string) => {
    return url.split('/').pop() || 'resume';
  };

  const upcomingSessions = sessions.filter(
    (s) => s.status === 'SCHEDULED' && new Date(s.scheduledTime) > new Date()
  );
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const displayName = profile?.name || user?.name || user?.email?.split('@')[0] || 'Student';
  const userInitials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // ✅ ADDED: upgrade screen (replaces full page when student clicks "Upgrade")
  if (showUpgrade && profile) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setShowUpgrade(false)} className="text-slate-500 hover:text-slate-700">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Upgrade to Pro</h1>
        </div>
        <PaymentGate
          planType={profile.planType}
          used={Math.max(profile.interviewsUsed, profile.guidanceUsed)}
          limit={Math.max(profile.interviewsLimit, profile.guidanceLimit)}
          sessionType="interview" onPaymentSuccessAction={function (): void {
            throw new Error('Function not implemented.');
          } }        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with Profile Picture */}
      <div className="flex items-center gap-6 mb-8">
        {/* Profile Picture */}
        <div className="relative">
          {user?.profilePicture ? (
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg ring-2 ring-indigo-100">
              <Image
                src={user.profilePicture}
                alt={displayName}
                width={96}
                height={96}
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-2 ring-indigo-100">
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
            <p className="text-sm text-indigo-600 mt-1 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Signed in with Google
            </p>
          )}
        </div>
      </div>

      {/* ✅ ADDED: Subscription status card — sits between header and Profile Section */}
      {profile && (
        <SubscriptionCard profile={profile} onUpgrade={() => setShowUpgrade(true)} />
      )}

      {/* Profile Section */}
      <Card variant="elevated" className="p-8 mb-8">
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
                label="College/University"
                value={formData.college}
                onChange={(e) => setFormData({ ...formData, college: e.target.value })}
              />
              <Input
                label="Branch/Major"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              />
              <Input
                label="Graduation Year"
                type="number"
                value={formData.graduationYear}
                onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
              />
              <Input
                label="Target Role"
                value={formData.targetRole}
                onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                placeholder="e.g., Software Engineer"
              />
              <Input
                label="Experience Level"
                value={formData.experienceLevel}
                onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
                placeholder="e.g., Entry Level, 2 years"
              />
            </div>
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
              <p className="text-sm text-slate-500 mb-1">College</p>
              <p className="font-medium text-slate-900">{profile.college || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Branch</p>
              <p className="font-medium text-slate-900">{profile.branch || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Graduation Year</p>
              <p className="font-medium text-slate-900">{profile.graduationYear || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Target Role</p>
              <p className="font-medium text-slate-900">{profile.targetRole || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Experience Level</p>
              <p className="font-medium text-slate-900">{profile.experienceLevel || 'Not set'}</p>
            </div>
          </div>
        ) : null}

        {/* Resume Upload Section */}
        {profile && (
          <div className="mt-8 pt-8 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Resume</h3>
            
            {profile.resumeUrl ? (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Resume uploaded</p>
                    <p className="text-sm text-slate-600">{getResumeFileName(profile.resumeUrl)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={profile.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                  >
                    View
                  </a>
                  <button
                    onClick={handleDeleteResume}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-slate-900 mb-2">Upload your resume</h4>
                <p className="text-sm text-slate-600 mb-4">
                  PDF, DOC, or DOCX (max 5MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  disabled={uploadingResume}
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload">
                  <Button
                    type="button"
                    disabled={uploadingResume}
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer"
                  >
                    {uploadingResume ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Uploading...
                      </span>
                    ) : (
                      'Choose File'
                    )}
                  </Button>
                </label>
                {resumeError && (
                  <p className="text-sm text-red-600 mt-2">{resumeError}</p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-indigo-600 mb-2">
            {upcomingSessions.length}
          </div>
          <p className="text-slate-600">Upcoming Sessions</p>
        </Card>
        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {completedSessions.length}
          </div>
          <p className="text-slate-600">Completed Sessions</p>
        </Card>
        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-violet-600 mb-2">
            {sessions.length}
          </div>
          <p className="text-slate-600">Total Sessions</p>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card variant="elevated" className="p-8">
        <h2 className="text-2xl font-display font-semibold text-slate-900 mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/student/book-guidance">
            <div className="p-6 bg-gradient-to-br from-indigo-50 to-violet-50 border-2 border-indigo-200 rounded-xl hover:shadow-lg transition-all cursor-pointer">
              <div className="text-3xl mb-3">🎓</div>
              <h3 className="font-semibold text-slate-900 mb-1">Book Guidance Session</h3>
              <p className="text-sm text-slate-600">
                Get mentorship from industry experts
              </p>
              {/* ✅ ADDED: sessions remaining hint */}
              {profile && (
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  {profile.guidanceLimit - profile.guidanceUsed} sessions remaining
                </p>
              )}
            </div>
          </Link>
          <Link href="/student/book-interview">
            <div className="p-6 bg-gradient-to-br from-violet-50 to-pink-50 border-2 border-violet-200 rounded-xl hover:shadow-lg transition-all cursor-pointer">
              <div className="text-3xl mb-3">💼</div>
              <h3 className="font-semibold text-slate-900 mb-1">Book Mock Interview</h3>
              <p className="text-sm text-slate-600">
                Practice with realistic interview scenarios
              </p>
              {/* ✅ ADDED: interviews remaining hint */}
              {profile && (
                <p className="text-xs text-violet-600 mt-2 font-medium">
                  {profile.interviewsLimit - profile.interviewsUsed} interviews remaining
                </p>
              )}
            </div>
          </Link>
        </div>
      </Card>
    </div>
  );
}