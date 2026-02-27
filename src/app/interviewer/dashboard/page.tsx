'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
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
  return url.includes('googleusercontent.com') || url.includes('ggpht.com');
}

function hasCustomPhoto(user: any): boolean {
  return !!user?.profilePicture && !isGoogleDefaultPhoto(user.profilePicture);
}

// ─── Profile Header with LinkedIn photo sync ──────────────────────────────────
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
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photoReady = hasCustomPhoto(user);

  // ── Sync from LinkedIn ──────────────────────────────────────────────────────
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

  // ── Manual upload ───────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg(null);
    setUploading(true);
    const fd = new FormData();
    fd.append('photo', file);
    try {
      const res = await fetch('/api/interviewer/upload-profile-picture', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg({ type: 'success', text: 'Profile photo uploaded!' });
        setSyncMsg(null);
        onPhotoUpdated();
      } else {
        setUploadMsg({ type: 'error', text: data.error || 'Upload failed.' });
      }
    } catch {
      setUploadMsg({ type: 'error', text: 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const msgColors = {
    success: 'bg-green-50 text-green-700 border-green-200',
    error:   'bg-red-50 text-red-700 border-red-200',
    warn:    'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <div className="flex items-start gap-6 mb-8 flex-wrap">
      {/* Avatar */}
      <div className="relative shrink-0">
        {photoReady ? (
          <Image
            src={user.profilePicture}
            alt={displayName}
            width={80}
            height={80}
            className="rounded-full object-cover border-4 border-white shadow-lg"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center border-4 border-white shadow-lg">
            <span className="text-white text-2xl font-bold">{userInitials}</span>
          </div>
        )}
        {!photoReady && (
          <div
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow-md border-2 border-white"
            title="Profile photo missing"
          >
            <span className="text-white text-xs font-bold">!</span>
          </div>
        )}
      </div>

      {/* Name + actions */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="text-3xl font-display font-bold text-slate-900">{displayName}</h1>
          {profile && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              profile.status === 'APPROVED'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {profile.status === 'APPROVED' ? '✅ Approved Interviewer' : `⏳ ${profile.status}`}
            </span>
          )}
        </div>
        <p className="text-slate-500 mb-3">{user?.email}</p>

        {/* Photo missing banner */}
        {!photoReady && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex-1 min-w-[180px]">
              <p className="text-xs font-semibold text-amber-700 mb-0.5">📸 Profile photo required</p>
              <p className="text-[11px] text-amber-600">
                Shown to students when booking — add a clear headshot.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* LinkedIn sync */}
              {profile?.linkedinUrl ? (
                <button
                  onClick={handleLinkedInSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A66C2] hover:bg-[#004182] disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Syncing…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      Sync from LinkedIn
                    </>
                  )}
                </button>
              ) : (
                <span className="text-[11px] text-amber-600 italic">
                  Add LinkedIn URL in profile to auto-sync
                </span>
              )}
              {/* Manual upload */}
              <label
                htmlFor="header-photo-upload"
                className={`flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 bg-white hover:bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Upload photo
                  </>
                )}
              </label>
              <input
                ref={fileInputRef}
                id="header-photo-upload"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {/* Status messages */}
            {(syncMsg || uploadMsg) && (
              <div className="w-full mt-1 space-y-1">
                {syncMsg && (
                  <p className={`text-xs px-3 py-1.5 rounded-lg border ${msgColors[syncMsg.type]}`}>
                    {syncMsg.type === 'success' ? '✅ ' : syncMsg.type === 'warn' ? '⚠️ ' : '❌ '}{syncMsg.text}
                  </p>
                )}
                {uploadMsg && (
                  <p className={`text-xs px-3 py-1.5 rounded-lg border ${msgColors[uploadMsg.type]}`}>
                    {uploadMsg.type === 'success' ? '✅ ' : '❌ '}{uploadMsg.text}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Change photo when photo already set */}
        {photoReady && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="header-photo-upload"
              className="text-xs text-indigo-600 hover:underline cursor-pointer font-medium"
            >
              Change photo
            </label>
            <input
              ref={fileInputRef}
              id="header-photo-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploading && <span className="text-xs text-slate-400">Uploading…</span>}
            {uploadMsg && (
              <span className={`text-xs ${uploadMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {uploadMsg.type === 'success' ? '✅ ' : '❌ '}{uploadMsg.text}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Document Upload Section ──────────────────────────────────────────────────
function DocumentUploadSection({
  profile, resumeFile, idCardFile, setResumeFile, setIdCardFile,
  resumeInputRef, idCardInputRef, onUpload, uploading, error, success,
}: any) {
  return (
    <Card variant="elevated" className="p-8 mt-6">
      <h2 className="text-2xl font-display font-semibold text-slate-900 mb-2">
        Verification Documents
      </h2>
      <p className="text-slate-500 text-sm mb-6">
        Upload your resume and company ID card so the admin can verify your credentials
        before approving your profile.
      </p>

      <div className="grid grid-cols-2 gap-6">
        {/* Resume */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">📄 Resume / CV</label>
          {profile?.resumeUrl && (
            <div className="flex items-center gap-2 mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-600 text-sm">✅ Uploaded</span>
              <a
                href={profile.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline ml-auto"
              >
                View →
              </a>
            </div>
          )}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 hover:border-indigo-400 transition-colors">
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              id="resume-upload"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="resume-upload" className="cursor-pointer block text-center">
              <div className="text-2xl mb-1">📎</div>
              {resumeFile ? (
                <p className="text-sm font-medium text-indigo-600">{resumeFile.name}</p>
              ) : (
                <p className="text-sm text-slate-500">Click to select PDF, DOC, or DOCX</p>
              )}
            </label>
          </div>
        </div>

        {/* ID Card */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">🪪 Company ID Card</label>
          {profile?.idCardUrl && (
            <div className="flex items-center gap-2 mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-600 text-sm">✅ Uploaded</span>
              <a
                href={profile.idCardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline ml-auto"
              >
                View →
              </a>
            </div>
          )}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 hover:border-indigo-400 transition-colors">
            <input
              ref={idCardInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              id="idcard-upload"
              onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="idcard-upload" className="cursor-pointer block text-center">
              <div className="text-2xl mb-1">🖼️</div>
              {idCardFile ? (
                <p className="text-sm font-medium text-indigo-600">{idCardFile.name}</p>
              ) : (
                <p className="text-sm text-slate-500">Click to select PDF, JPG, or PNG</p>
              )}
            </label>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ❌ {error}
        </p>
      )}
      {success && (
        <p className="mt-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          ✅ {success}
        </p>
      )}

      {(resumeFile || idCardFile) && (
        <div className="mt-4">
          <Button onClick={onUpload} disabled={uploading}>
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

  // Document upload state
  const [resumeFile, setResumeFile]   = useState<File | null>(null);
  const [idCardFile, setIdCardFile]   = useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docError, setDocError]   = useState('');
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

  // Re-fetch when layout's Settings modal saves profile
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
          // No profile yet — open edit mode immediately
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
        // If LinkedIn photo was auto-synced, notify layout to re-fetch user
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
    if (!resumeFile && !idCardFile) {
      setDocError('Please select at least one file to upload.');
      return;
    }
    setDocError('');
    setDocSuccess('');
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
        setResumeFile(null);
        setIdCardFile(null);
        if (resumeInputRef.current) resumeInputRef.current.value = '';
        if (idCardInputRef.current) idCardInputRef.current.value = '';
        await fetchProfile();
      }
    } catch {
      setDocError('Upload failed. Please try again.');
    } finally {
      setUploadingDocs(false);
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
    setFormData(prev => {
      const next = prev.sessionTypesOffered.includes(type)
        ? prev.sessionTypesOffered.filter(t => t !== type)
        : [...prev.sessionTypesOffered, type];
      return {
        ...prev,
        sessionTypesOffered: next,
        // Clear interview types when INTERVIEW session type is removed
        interviewTypesOffered:
          type === 'INTERVIEW' && prev.sessionTypesOffered.includes(type)
            ? []
            : prev.interviewTypesOffered,
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

  const displayName  = profile?.name || user?.name || user?.email?.split('@')[0] || 'Interviewer';
  const userInitials = displayName.split(' ').map((n: string) => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
  const offersInterview = formData.sessionTypesOffered.includes('INTERVIEW');

  // ── Loading ────────────────────────────────────────────────────────────────
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

  // ── PENDING ────────────────────────────────────────────────────────────────
  if (profile?.status === 'PENDING') {
    return (
      <div className="max-w-4xl mx-auto">
        <ProfileHeader
          user={user}
          profile={profile}
          displayName={displayName}
          userInitials={userInitials}
          onPhotoUpdated={fetchProfile}
        />
        <Card variant="elevated" className="p-8 text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-display font-bold text-slate-900 mb-2">Profile Under Review</h1>
          <p className="text-slate-600 mb-6">
            Your profile is pending admin approval. You'll be notified once approved.
          </p>
        </Card>
        <DocumentUploadSection
          profile={profile}
          resumeFile={resumeFile}
          idCardFile={idCardFile}
          setResumeFile={setResumeFile}
          setIdCardFile={setIdCardFile}
          resumeInputRef={resumeInputRef}
          idCardInputRef={idCardInputRef}
          onUpload={handleUploadDocuments}
          uploading={uploadingDocs}
          error={docError}
          success={docSuccess}
        />
      </div>
    );
  }

  // ── REJECTED ───────────────────────────────────────────────────────────────
  if (profile?.status === 'REJECTED') {
    return (
      <div className="max-w-4xl mx-auto">
        <ProfileHeader
          user={user}
          profile={profile}
          displayName={displayName}
          userInitials={userInitials}
          onPhotoUpdated={fetchProfile}
        />
        <Card variant="elevated" className="p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-display font-bold text-slate-900 mb-2">Profile Not Approved</h1>
          <p className="text-slate-600">
            Your profile was not approved. Please contact support for more information.
          </p>
        </Card>
      </div>
    );
  }

  // ── MAIN DASHBOARD ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">

      <ProfileHeader
        user={user}
        profile={profile}
        displayName={displayName}
        userInitials={userInitials}
        onPhotoUpdated={fetchProfile}
      />

      {/* Profile Card */}
      <Card variant="elevated" className="p-8 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-display font-semibold text-slate-900">Your Profile</h2>
          {profile && !editing && (
            <Button onClick={() => setEditing(true)} variant="secondary" size="sm">
              Edit Profile
            </Button>
          )}
        </div>

        {editing ? (
          // ── EDIT MODE ────────────────────────────────────────────────────────
          <form onSubmit={handleSaveProfile} className="space-y-5">
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
              placeholder="Software Engineer, Product Manager, Data Scientist"
              required
            />

            {/* Difficulty Levels */}
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
                    className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                      formData.difficultyLevels.includes(level)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-indigo-700 border-indigo-300 hover:border-indigo-500'
                    }`}
                  >
                    {level.charAt(0) + level.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Session Types */}
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
                    className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                      formData.sessionTypesOffered.includes(type)
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-violet-700 border-violet-300 hover:border-violet-500'
                    }`}
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Interview Types — shown only when INTERVIEW is selected */}
            {offersInterview && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Interview Types Offered
                </label>
                <p className="text-xs text-slate-500 mb-2">Select all that apply.</p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(INTERVIEW_TYPE_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleInterviewType(value)}
                      className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                        formData.interviewTypesOffered.includes(value)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-indigo-700 border-indigo-300 hover:border-indigo-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {formData.interviewTypesOffered.length === 0 && (
                  <p className="text-xs text-red-500 mt-2">
                    ⚠️ Select at least one type to be matched with students
                  </p>
                )}
              </div>
            )}

            <Input
              label="LinkedIn URL"
              value={formData.linkedinUrl}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
              placeholder="https://linkedin.com/in/yourprofile"
            />

            <div className="flex gap-3">
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
          // ── VIEW MODE ────────────────────────────────────────────────────────
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-slate-500 mb-1">Companies</p>
              <p className="font-medium text-slate-900">{profile.companies?.join(', ') || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Experience</p>
              <p className="font-medium text-slate-900">
                {profile.yearsOfExperience ? `${profile.yearsOfExperience} years` : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Roles</p>
              <p className="font-medium text-slate-900">{profile.rolesSupported?.join(', ') || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Difficulty</p>
              <p className="font-medium text-slate-900">{profile.difficultyLevels?.join(', ') || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Session Types</p>
              <p className="font-medium text-slate-900">{profile.sessionTypesOffered?.join(', ') || 'Not set'}</p>
            </div>
            {profile.sessionTypesOffered?.includes('INTERVIEW') && (
              <div>
                <p className="text-sm text-slate-500 mb-1">Interview Types</p>
                {profile.interviewTypesOffered?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {profile.interviewTypesOffered.map((type: string) => (
                      <span
                        key={type}
                        className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium"
                      >
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
              <p className="text-sm text-slate-500 mb-1">LinkedIn</p>
              {profile.linkedinUrl ? (
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-violet-600 hover:text-violet-700 underline"
                >
                  View Profile →
                </a>
              ) : (
                <p className="font-medium text-slate-400">Not set</p>
              )}
            </div>
          </div>
        ) : null}
      </Card>

      {/* Document Upload Section */}
      <DocumentUploadSection
        profile={profile}
        resumeFile={resumeFile}
        idCardFile={idCardFile}
        setResumeFile={setResumeFile}
        setIdCardFile={setIdCardFile}
        resumeInputRef={resumeInputRef}
        idCardInputRef={idCardInputRef}
        onUpload={handleUploadDocuments}
        uploading={uploadingDocs}
        error={docError}
        success={docSuccess}
      />
    </div>
  );
}