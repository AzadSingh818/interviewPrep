'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

// ─── Interview type display labels ────────────────────────────────────────────
const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical',
  HR: 'HR / Behavioral',
  MIXED: 'Mixed (Technical + HR)',
};

// ─── Helper ───────────────────────────────────────────────────────────────────
function isGoogleDefaultPhoto(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.startsWith('data:image/')) return false;
  return url.includes('googleusercontent.com') || url.includes('ggpht.com');
}

function hasCustomPhoto(user: any): boolean {
  return !!user?.profilePicture && !isGoogleDefaultPhoto(user.profilePicture);
}

// ─── Profile Header ───────────────────────────────────────────────────────────
function ProfileHeader({
  user,
  profile,
  displayName,
  userInitials,
  onPhotoUpdated,
}: {
  user: any;
  profile: any;
  displayName: string;
  userInitials: string;
  onPhotoUpdated: () => void;
}) {
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoReady = hasCustomPhoto(user);

  const handleLinkedInSync = async () => {
    if (!profile?.linkedinUrl) {
      setSyncMsg({ type: 'warn', text: 'Add your LinkedIn URL in the profile form first.' });
      return;
    }
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/interviewer/sync-linkedin-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinUrl: profile.linkedinUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg({ type: 'success', text: 'Profile photo synced from LinkedIn!' });
        onPhotoUpdated();
      } else {
        setSyncMsg({
          type: data.code === 'PHOTO_NOT_FOUND' || data.code === 'LINKEDIN_BLOCKED' ? 'warn' : 'error',
          text: data.error || 'Could not fetch photo from LinkedIn.',
        });
      }
    } catch {
      setSyncMsg({ type: 'error', text: 'Something went wrong. Please try uploading manually.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch('/api/interviewer/upload-profile-picture', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg({ type: 'success', text: 'Photo uploaded!' });
        onPhotoUpdated();
      } else {
        setUploadMsg({ type: 'error', text: data.error || 'Upload failed.' });
      }
    } catch {
      setUploadMsg({ type: 'error', text: 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const statusColor = profile?.status === 'APPROVED'
    ? 'bg-green-100 text-green-700 border-green-200'
    : profile?.status === 'REJECTED'
      ? 'bg-red-100 text-red-700 border-red-200'
      : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <Card variant="elevated" className="p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
        {/* Avatar */}
        <div className="relative shrink-0">
          {photoReady ? (
            <img
              src={user.profilePicture}
              alt={displayName}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center border-4 border-white shadow-lg">
              <span className="text-white font-bold text-2xl sm:text-3xl">{userInitials}</span>
            </div>
          )}
          {user?.provider === 'GOOGLE' && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow border border-slate-100">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white truncate">{displayName}</h1>
          {profile?.status && (
            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
              {profile.status === 'APPROVED' ? '✅ Approved Interviewer'
                : profile.status === 'REJECTED' ? '❌ Not Approved'
                : '⏳ Pending Approval'}
            </span>
          )}
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 truncate">{user?.email}</p>

          {/* Photo actions */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Change photo'}
            </button>
            {profile?.linkedinUrl && (
              <button
                onClick={handleLinkedInSync}
                disabled={syncing}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium underline disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync from LinkedIn'}
              </button>
            )}
          </div>

          {(syncMsg || uploadMsg) && (
            <p className={`text-xs mt-2 ${
              (syncMsg?.type || uploadMsg?.type) === 'success' ? 'text-green-600'
              : (syncMsg?.type || uploadMsg?.type) === 'warn' ? 'text-amber-600'
              : 'text-red-600'
            }`}>
              {syncMsg?.text || uploadMsg?.text}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Document Upload Section ──────────────────────────────────────────────────
function DocumentUploadSection({
  profile,
  resumeFile,
  idCardFile,
  setResumeFile,
  setIdCardFile,
  resumeInputRef,
  idCardInputRef,
  onUpload,
  uploading,
  error,
  success,
}: any) {
  return (
    <Card variant="elevated" className="p-4 sm:p-6 mb-4 sm:mb-6">
      <h2 className="text-lg sm:text-xl font-display font-semibold text-slate-900 dark:text-white mb-1">
        Verification Documents
      </h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
        Upload your resume and company ID card so the admin can verify your credentials before approving your profile.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Resume */}
        <div className="p-3 border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-xl">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">📄 Resume / CV</p>
          {profile?.resumeUrl ? (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-green-600 font-medium">✅ Uploaded</span>
              <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline">View →</a>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-2">No resume uploaded yet</p>
          )}
          <input
            ref={resumeInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={e => setResumeFile(e.target.files?.[0] || null)}
          />
          <button
            onClick={() => resumeInputRef.current?.click()}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            {resumeFile ? `Selected: ${resumeFile.name}` : profile?.resumeUrl ? 'Replace file' : 'Choose file'}
          </button>
        </div>

        {/* ID Card */}
        <div className="p-3 border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-xl">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">🪪 Company ID Card</p>
          {profile?.idCardUrl ? (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-green-600 font-medium">✅ Uploaded</span>
              <a href={profile.idCardUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline">View →</a>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-2">No ID card uploaded yet</p>
          )}
          <input
            ref={idCardInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={e => setIdCardFile(e.target.files?.[0] || null)}
          />
          <button
            onClick={() => idCardInputRef.current?.click()}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            {idCardFile ? `Selected: ${idCardFile.name}` : profile?.idCardUrl ? 'Replace file' : 'Choose file'}
          </button>
        </div>
      </div>

      {error   && <p className="text-red-600 text-sm mt-3">{error}</p>}
      {success && <p className="text-green-600 text-sm mt-3">{success}</p>}

      {(resumeFile || idCardFile) && (
        <div className="mt-4">
          <Button onClick={onUpload} disabled={uploading} size="sm">
            {uploading ? 'Uploading...' : 'Upload Documents'}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InterviewerDashboardPage() {
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docError, setDocError]     = useState('');
  const [docSuccess, setDocSuccess] = useState('');
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const idCardInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name:                  '',
    education:             '',
    companies:             '',
    yearsOfExperience:     '',
    rolesSupported:        '',
    difficultyLevels:      [] as string[],
    sessionTypesOffered:   [] as string[],
    interviewTypesOffered: [] as string[],
    linkedinUrl:           '',
  });

  useEffect(() => { fetchProfile(); }, []);

  useEffect(() => {
    const onSaved = () => fetchProfile();
    window.addEventListener('profile-saved', onSaved);
    return () => window.removeEventListener('profile-saved', onSaved);
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
            name:                  data.profile.name                  || '',
            education:             data.profile.education             || '',
            companies:             data.profile.companies?.join(', ') || '',
            yearsOfExperience:     data.profile.yearsOfExperience?.toString() || '',
            rolesSupported:        data.profile.rolesSupported?.join(', ') || '',
            difficultyLevels:      data.profile.difficultyLevels      || [],
            sessionTypesOffered:   data.profile.sessionTypesOffered   || [],
            interviewTypesOffered: data.profile.interviewTypesOffered || [],
            linkedinUrl:           data.profile.linkedinUrl           || '',
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
    setSaving(true);
    try {
      const res = await fetch('/api/interviewer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companies:      formData.companies.split(',').map(c => c.trim()).filter(Boolean),
          rolesSupported: formData.rolesSupported.split(',').map(r => r.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProfile();
        setEditing(false);
        if (data.linkedinPhotoSynced) {
          window.dispatchEvent(new Event('profile-saved'));
        }
      } else {
        alert(data.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocuments = async () => {
    if (!resumeFile && !idCardFile) { setDocError('Please select at least one file to upload.'); return; }
    setDocError(''); setDocSuccess('');
    setUploadingDocs(true);
    try {
      const fd = new FormData();
      if (resumeFile) fd.append('resume', resumeFile);
      if (idCardFile) fd.append('idCard', idCardFile);
      const res = await fetch('/api/interviewer/upload-documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setDocError(data.error || 'Upload failed');
      } else {
        setDocSuccess('Documents uploaded successfully!');
        setResumeFile(null); setIdCardFile(null);
        if (resumeInputRef.current) resumeInputRef.current.value = '';
        if (idCardInputRef.current) idCardInputRef.current.value = '';
        await fetchProfile();
      }
    } catch { setDocError('Upload failed. Please try again.'); }
    finally { setUploadingDocs(false); }
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
    setFormData(prev => {
      const next = prev.sessionTypesOffered.includes(type)
        ? prev.sessionTypesOffered.filter(t => t !== type)
        : [...prev.sessionTypesOffered, type];
      return {
        ...prev,
        sessionTypesOffered: next,
        interviewTypesOffered:
          type === 'INTERVIEW' && prev.sessionTypesOffered.includes(type)
            ? [] : prev.interviewTypesOffered,
      };
    });
  };

  const toggleInterviewType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      interviewTypesOffered: prev.interviewTypesOffered.includes(type)
        ? prev.interviewTypesOffered.filter(t => t !== type)
        : [...prev.interviewTypesOffered, type],
    }));
  };

  const displayName    = profile?.name || user?.name || user?.email?.split('@')[0] || 'Interviewer';
  const userInitials   = displayName.split(' ').map((n: string) => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
  const offersInterview = formData.sessionTypesOffered.includes('INTERVIEW');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (profile?.status === 'PENDING') {
    return (
      <div className="max-w-2xl mx-auto">
        <ProfileHeader user={user} profile={profile} displayName={displayName} userInitials={userInitials} onPhotoUpdated={fetchProfile} />
        <Card variant="elevated" className="p-6 sm:p-8 text-center mb-4">
          <div className="text-5xl sm:text-6xl mb-4">⏳</div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">Profile Under Review</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm sm:text-base">
            Your profile is pending admin approval. You'll be notified once approved.
          </p>
        </Card>
        <DocumentUploadSection
          profile={profile} resumeFile={resumeFile} idCardFile={idCardFile}
          setResumeFile={setResumeFile} setIdCardFile={setIdCardFile}
          resumeInputRef={resumeInputRef} idCardInputRef={idCardInputRef}
          onUpload={handleUploadDocuments} uploading={uploadingDocs}
          error={docError} success={docSuccess}
        />
      </div>
    );
  }

  if (profile?.status === 'REJECTED') {
    return (
      <div className="max-w-2xl mx-auto">
        <ProfileHeader user={user} profile={profile} displayName={displayName} userInitials={userInitials} onPhotoUpdated={fetchProfile} />
        <Card variant="elevated" className="p-6 sm:p-8 text-center">
          <div className="text-5xl sm:text-6xl mb-4">❌</div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">Profile Not Approved</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">Your profile was not approved. Please contact support for more information.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">

      <ProfileHeader user={user} profile={profile} displayName={displayName} userInitials={userInitials} onPhotoUpdated={fetchProfile} />

      {/* Profile Card */}
      <Card variant="elevated" className="p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-display font-semibold text-slate-900 dark:text-white">Your Profile</h2>
          {profile && !editing && (
            <Button onClick={() => setEditing(true)} variant="secondary" size="sm">
              Edit Profile
            </Button>
          )}
        </div>

        {editing ? (
          // ── EDIT MODE ────────────────────────────────────────────────────────
          <form onSubmit={handleSaveProfile} className="space-y-4 sm:space-y-5">
            {/* Responsive 1-col on mobile, 2-col on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Input label="Full Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              <Input label="Education" value={formData.education} onChange={(e) => setFormData({ ...formData, education: e.target.value })} />
              <Input label="Companies (comma-separated)" value={formData.companies} onChange={(e) => setFormData({ ...formData, companies: e.target.value })} placeholder="Google, Microsoft" />
              <Input label="Years of Experience" type="number" value={formData.yearsOfExperience} onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })} />
            </div>
            <Input label="Roles Supported (comma-separated)" value={formData.rolesSupported} onChange={(e) => setFormData({ ...formData, rolesSupported: e.target.value })} placeholder="Software Engineer, Data Scientist" required />

            {/* Difficulty Levels */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Difficulty Levels</label>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {['EASY', 'MEDIUM', 'HARD'].map(level => (
                  <button key={level} type="button" onClick={() => toggleDifficulty(level)}
                    className={`px-3 sm:px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                      formData.difficultyLevels.includes(level) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 border-indigo-300 hover:border-indigo-500'
                    }`}>
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Session Types */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Session Types</label>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {['GUIDANCE', 'INTERVIEW'].map(type => (
                  <button key={type} type="button" onClick={() => toggleSessionType(type)}
                    className={`px-3 sm:px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                      formData.sessionTypesOffered.includes(type) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-gray-800 text-violet-700 dark:text-violet-300 border-violet-300 hover:border-violet-500'
                    }`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Interview Types (conditional) */}
            {offersInterview && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Interview Types</label>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {Object.entries(INTERVIEW_TYPE_LABELS).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => toggleInterviewType(value)}
                      className={`px-3 sm:px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                        formData.interviewTypesOffered.includes(value) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 border-indigo-300 hover:border-indigo-500'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {formData.interviewTypesOffered.length === 0 && (
                  <p className="text-xs text-red-500 mt-2">⚠️ Select at least one type to be matched with students</p>
                )}
              </div>
            )}

            <Input label="LinkedIn URL" value={formData.linkedinUrl} onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/yourprofile" />

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
              {profile && (
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : profile ? (
          // ── VIEW MODE — fully responsive grid ────────────────────────────────
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-1">Companies</p>
              <p className="font-medium text-slate-900 dark:text-white text-sm sm:text-base break-words">
                {profile.companies?.join(', ') || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-1">Experience</p>
              <p className="font-medium text-slate-900 dark:text-white text-sm sm:text-base">
                {profile.yearsOfExperience ? `${profile.yearsOfExperience} years` : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-1">Roles</p>
              <p className="font-medium text-slate-900 dark:text-white text-sm sm:text-base break-words">
                {profile.rolesSupported?.join(', ') || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-1">Difficulty</p>
              <p className="font-medium text-slate-900 dark:text-white text-sm sm:text-base">
                {profile.difficultyLevels?.join(', ') || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-1">Session Types</p>
              <p className="font-medium text-slate-900 dark:text-white text-sm sm:text-base">
                {profile.sessionTypesOffered?.join(', ') || 'Not set'}
              </p>
            </div>
            {profile.sessionTypesOffered?.includes('INTERVIEW') && (
              <div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-1">Interview Types</p>
                {profile.interviewTypesOffered?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {profile.interviewTypesOffered.map((type: string) => (
                      <span key={type} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                        {INTERVIEW_TYPE_LABELS[type] ?? type}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium text-amber-600 text-sm">⚠️ Not set — edit profile</p>
                )}
              </div>
            )}
            <div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-1">LinkedIn</p>
              {profile.linkedinUrl ? (
                <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="font-medium text-violet-600 hover:text-violet-700 underline text-sm break-all">
                  View Profile →
                </a>
              ) : (
                <p className="font-medium text-slate-400 text-sm">Not set</p>
              )}
            </div>
          </div>
        ) : null}
      </Card>

      {/* Document Upload */}
      <DocumentUploadSection
        profile={profile} resumeFile={resumeFile} idCardFile={idCardFile}
        setResumeFile={setResumeFile} setIdCardFile={setIdCardFile}
        resumeInputRef={resumeInputRef} idCardInputRef={idCardInputRef}
        onUpload={handleUploadDocuments} uploading={uploadingDocs}
        error={docError} success={docSuccess}
      />
    </div>
  );
}