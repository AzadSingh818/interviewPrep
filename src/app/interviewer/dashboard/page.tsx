'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

// ─── Reusable Profile Header ──────────────────────────────────────────────────
function ProfileHeader({ user, displayName, userInitials }: {
  user: any; displayName: string; userInitials: string;
}) {
  return (
    <div className="flex items-center gap-6 mb-8">
      <div className="relative">
        {user?.profilePicture ? (
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
      </div>
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">{displayName}</h1>
        <p className="text-slate-500">{user?.email}</p>
      </div>
    </div>
  );
}

// ─── Interview type display labels ───────────────────────────────────────────
const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical',
  HR: 'HR / Behavioral',
  MIXED: 'Mixed (Technical + HR)',
};

export default function InterviewerDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Document upload state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docError, setDocError] = useState('');
  const [docSuccess, setDocSuccess] = useState('');
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const idCardInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    education: '',
    companies: '',
    yearsOfExperience: '',
    rolesSupported: '',
    difficultyLevels: [] as string[],
    sessionTypesOffered: [] as string[],
    interviewTypesOffered: [] as string[], // ✅ NEW
    linkedinUrl: '',
  });

  useEffect(() => { fetchProfile(); }, []);

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
            interviewTypesOffered: data.profile.interviewTypesOffered || [], // ✅
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
    setSaving(true);
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
      const data = await res.json();
      if (res.ok) {
        await fetchProfile();
        setEditing(false);
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
        // If INTERVIEW is being removed, clear interview types too
        interviewTypesOffered: type === 'INTERVIEW' && prev.sessionTypesOffered.includes(type)
          ? []
          : prev.interviewTypesOffered,
      };
    });
  };

  // ✅ NEW: Toggle TECHNICAL / HR / MIXED
  const toggleInterviewType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      interviewTypesOffered: prev.interviewTypesOffered.includes(type)
        ? prev.interviewTypesOffered.filter(t => t !== type)
        : [...prev.interviewTypesOffered, type],
    }));
  };

  const displayName = profile?.name || user?.name || user?.email?.split('@')[0] || 'Interviewer';
  const userInitials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Whether INTERVIEW is currently selected in edit form
  const offersInterview = formData.sessionTypesOffered.includes('INTERVIEW');

  if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>;

  // ─── PENDING STATE ────────────────────────────────────────────────────────────
  if (profile?.status === 'PENDING') {
    return (
      <div className="max-w-4xl mx-auto">
        <ProfileHeader user={user} displayName={displayName} userInitials={userInitials} />
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

  // ─── REJECTED STATE ───────────────────────────────────────────────────────────
  if (profile?.status === 'REJECTED') {
    return (
      <div className="max-w-4xl mx-auto">
        <ProfileHeader user={user} displayName={displayName} userInitials={userInitials} />
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

  // ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-6 mb-8">
        <div className="relative">
          {user?.profilePicture ? (
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
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-slate-900">{displayName}</h1>
            {profile && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                profile.status === 'APPROVED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {profile.status === 'APPROVED' ? '✅ Approved Interviewer' : `⏳ ${profile.status}`}
              </span>
            )}
          </div>
          <p className="text-slate-500">{user?.email}</p>
        </div>
      </div>

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
          // ── EDIT MODE ──────────────────────────────────────────────────────────
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
                        : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    {level}
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
                        : 'bg-white text-slate-700 border-slate-300 hover:border-violet-400'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* ✅ Interview Types — only visible when INTERVIEW is selected */}
            {offersInterview && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <label className="block text-sm font-semibold text-indigo-900 mb-1">
                  Interview Types You Can Conduct
                </label>
                <p className="text-xs text-indigo-600 mb-3">
                  Students will be matched to you based on this. Select all that apply.
                </p>
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
          // ── VIEW MODE ──────────────────────────────────────────────────────────
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
            {/* ✅ Show interview types when INTERVIEW is offered */}
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

// ─── Document Upload Section ──────────────────────────────────────────────────
function DocumentUploadSection({ profile, resumeFile, idCardFile, setResumeFile, setIdCardFile,
  resumeInputRef, idCardInputRef, onUpload, uploading, error, success }: any) {
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
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          ✅ {success}
        </p>
      )}

      <div className="mt-4">
        <Button onClick={onUpload} disabled={uploading || (!resumeFile && !idCardFile)}>
          {uploading ? 'Uploading...' : 'Upload Documents'}
        </Button>
      </div>
    </Card>
  );
}