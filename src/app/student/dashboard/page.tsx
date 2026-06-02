"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { PaymentGate } from "@/components/shared/PaymentGate";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  name: string;
  college?: string;
  branch?: string;
  graduationYear?: number;
  targetRole?: string;
  experienceLevel?: string;
  resumeUrl?: string;
  planType: "FREE" | "PRO";
  planExpiresAt?: string;
  interviewsUsed: number;
  interviewsLimit: number;
  guidanceUsed: number;
  guidanceLimit: number;
}

interface Feedback {
  technicalDepth?: number;
  problemSolving?: number;
  communication?: number;
  confidence?: number;
  hiringRecommendation?: string;
  summary?: string;
  strengths?: string;
  recommendations?: string;
}

interface Session {
  id: number;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  sessionType: "GUIDANCE" | "INTERVIEW";
  scheduledTime: string;
  topic?: string;
  role?: string;
  difficulty?: string;
  interviewer?: { name: string; user: { email: string } };
  feedback?: Feedback | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hiringLabel: Record<string, { text: string; color: string }> = {
  STRONG_HIRE: {
    text: "Strong Hire",
    color:
      "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  },
  HIRE: {
    text: "Hire",
    color:
      "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  },
  WEAK_HIRE: {
    text: "Weak Hire",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  },
  NO_HIRE: {
    text: "No Hire",
    color: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  },
};

const targetRoleOptions = [
  { value: "", label: "Select your target role" },
  { value: "Software Engineer", label: "Software Engineer" },
  { value: "Frontend Engineer", label: "Frontend Engineer" },
  { value: "Backend Engineer", label: "Backend Engineer" },
  { value: "Full Stack Engineer", label: "Full Stack Engineer" },
  { value: "Data Scientist", label: "Data Scientist" },
  { value: "DevOps Engineer", label: "DevOps Engineer" },
  { value: "Product Manager", label: "Product Manager" },
  { value: "SRE", label: "SRE" },
  { value: "Mobile Engineer", label: "Mobile Engineer" },
  { value: "AI/ML Engineer", label: "AI/ML Engineer" },
  { value: "Other", label: "Other" },
];

const experienceLevelOptions = [
  { value: "", label: "Select experience level" },
  { value: "Internship", label: "Internship" },
  { value: "Entry Level", label: "Entry Level" },
  { value: "1-2 years", label: "1-2 years" },
  { value: "3-5 years", label: "3-5 years" },
  { value: "5+ years", label: "5+ years" },
  { value: "Senior", label: "Senior" },
  { value: "Lead", label: "Lead" },
];

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
        <span>{label}</span>
        <span className="font-semibold text-indigo-600">{value}/5</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div
          className="h-1.5 bg-indigo-500 rounded-full transition-all"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}
// ── Cloudinary Helpers ───────────────────────────────────────────────────────
function getCloudinaryPreviewUrl(url: string): string {
  if (!url) return url;
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
}
// ─── Subscription Card ────────────────────────────────────────────────────────

function SubscriptionCard({ profile }: { profile: Profile }) {
  const isPro = profile.planType === "PRO";
  const expiryStr = profile.planExpiresAt
    ? new Date(profile.planExpiresAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const interviewPct = Math.min(
    (profile.interviewsUsed / profile.interviewsLimit) * 100,
    100,
  );
  const guidancePct = Math.min(
    (profile.guidanceUsed / profile.guidanceLimit) * 100,
    100,
  );
  const isAtLimit =
    profile.interviewsUsed >= profile.interviewsLimit ||
    profile.guidanceUsed >= profile.guidanceLimit;
  const isNearLimit =
    !isAtLimit &&
    (profile.interviewsLimit - profile.interviewsUsed <= 1 ||
      profile.guidanceLimit - profile.guidanceUsed <= 1);

  return (
    <Card
      variant="elevated"
      className={`theme-surface-card p-4 sm:p-6 mb-4 sm:mb-6 ${isPro ? "border-indigo-300 bg-gradient-to-r from-indigo-50 to-violet-50 dark:border-indigo-400/20 dark:from-indigo-500/10 dark:to-violet-500/10" : "border-slate-200 dark:border-white/10"}`}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`px-3 py-1 rounded-full text-sm font-bold ${isPro ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
            >
              {isPro ? "⭐ Pro Plan" : "🆓 Free Plan"}
            </span>
            {isPro && expiryStr && (
              <span className="text-xs text-indigo-600 dark:text-indigo-300">
                Expires {expiryStr}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {isPro
              ? "10 interviews + 10 guidance sessions per month"
              : "5 free interviews + 5 guidance sessions included"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
            <span>Mock Interviews</span>
            <span className="font-medium">
              {profile.interviewsUsed}/{profile.interviewsLimit}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${interviewPct >= 100 ? "bg-red-500" : interviewPct >= 80 ? "bg-amber-500" : "bg-indigo-500"}`}
              style={{ width: `${interviewPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
            <span>Guidance Sessions</span>
            <span className="font-medium">
              {profile.guidanceUsed}/{profile.guidanceLimit}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${guidancePct >= 100 ? "bg-red-500" : guidancePct >= 80 ? "bg-amber-500" : "bg-violet-500"}`}
              style={{ width: `${guidancePct}%` }}
            />
          </div>
        </div>
      </div>

      {isNearLimit && !isPro && (
        <p className="text-xs text-amber-600 dark:text-amber-300 mt-3 font-medium">
          ⚠️ Almost out of free sessions. Upgrade to Pro from the sidebar to
          keep going.
        </p>
      )}
      {isAtLimit && (
        <p className="text-xs text-red-600 dark:text-red-300 mt-3 font-medium">
          ⚠️ You've reached your limit.{" "}
          {isPro
            ? "Renew your plan to continue booking."
            : "Upgrade to Pro from the sidebar to book more sessions."}
        </p>
      )}
    </Card>
  );
}

// ─── Readiness Score ──────────────────────────────────────────────────────────

function ReadinessCard({
  profile,
  sessions,
}: {
  profile: Profile;
  sessions: Session[];
}) {
  const checks = [
    { label: "Profile set up", done: !!(profile.name && profile.college) },
    { label: "Target role specified", done: !!profile.targetRole },
    { label: "Resume uploaded", done: !!profile.resumeUrl },
    { label: "First session booked", done: sessions.length > 0 },
    {
      label: "First session completed",
      done: sessions.some((s) => s.status === "COMPLETED"),
    },
  ];

  const score = Math.round(
    (checks.filter((c) => c.done).length / checks.length) * 100,
  );
  const scoreColor =
    score < 40
      ? "text-red-500"
      : score < 70
        ? "text-amber-500"
        : "text-green-600";
  const barColor =
    score < 40 ? "bg-red-400" : score < 70 ? "bg-amber-400" : "bg-green-500";

  return (
    <Card variant="elevated" className="theme-surface-card p-4 sm:p-6 mb-4 sm:mb-6">
      <h3 className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
        Interview Readiness
      </h3>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        {/* Score circle */}
        <div className="shrink-0 text-center sm:text-left">
          <p className={`text-4xl sm:text-5xl font-bold ${scoreColor}`}>
            {score}
            <span className="text-lg sm:text-xl text-slate-400 dark:text-slate-500 font-normal">
              /100
            </span>
          </p>
          <div className="w-32 sm:w-36 bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-3 mx-auto sm:mx-0">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {score < 40
              ? "Getting started"
              : score < 70
                ? "Good progress"
                : "Interview ready!"}
          </p>
        </div>

        {/* Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  c.done
                    ? "bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-300"
                    : "bg-slate-100 text-slate-400 border border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
                }`}
              >
                {c.done ? "✓" : "○"}
              </span>
              <span
                className={`text-sm ${c.done ? "text-slate-800 dark:text-slate-200 font-medium" : "text-slate-500 dark:text-slate-400"}`}
              >
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Contextual Banner ────────────────────────────────────────────────────────

function NextActionBanner({
  profile,
  sessions,
}: {
  profile: Profile;
  sessions: Session[];
}) {
  const isAtLimit =
    profile.interviewsUsed >= profile.interviewsLimit &&
    profile.guidanceUsed >= profile.guidanceLimit;

  if (isAtLimit && profile.planType === "FREE") {
    return (
      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 dark:bg-red-500/10 dark:border-red-400/20">
        <div className="flex items-center gap-3">
          <span className="text-xl sm:text-2xl">🚫</span>
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              You've used all your free sessions
            </p>
            <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
              Upgrade to Pro from the sidebar to continue.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (!profile.resumeUrl) {
    return (
      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start sm:items-center gap-3 dark:bg-amber-500/10 dark:border-amber-400/20">
        <span className="text-xl sm:text-2xl shrink-0">📄</span>
        <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
          <span className="font-semibold">Upload your resume</span> so
          interviewers can give personalised feedback.{" "}
          <a href="#resume" className="underline font-semibold">
            Do it now →
          </a>
        </p>
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start sm:items-center gap-3 dark:bg-indigo-500/10 dark:border-indigo-400/20">
        <span className="text-xl sm:text-2xl shrink-0">🚀</span>
        <p className="text-xs sm:text-sm text-indigo-800 dark:text-indigo-200">
          <span className="font-semibold">You're all set!</span> Book your first
          free mock interview or guidance session below.
        </p>
      </div>
    );
  }
  return null;
}

// ─── Recent Feedback ──────────────────────────────────────────────────────────

function RecentFeedbackCard({ sessions }: { sessions: Session[] }) {
  const withFeedback = sessions
    .filter((s) => s.status === "COMPLETED" && s.feedback)
    .slice(0, 2);
  if (withFeedback.length === 0) return null;

  return (
    <Card variant="elevated" className="theme-surface-card p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          Recent Feedback
        </h3>
        <Link href="/student/sessions">
          <span className="text-xs sm:text-sm text-indigo-600 hover:underline cursor-pointer">
            View all →
          </span>
        </Link>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {withFeedback.map((s) => {
          const f = s.feedback!;
          const isInterview = s.sessionType === "INTERVIEW";
          const rec = f.hiringRecommendation
            ? hiringLabel[f.hiringRecommendation]
            : null;

          return (
            <div
              key={s.id}
              className="theme-surface-subtle p-3 sm:p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base">
                    {isInterview ? "💼" : "🎓"}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                    {isInterview
                      ? `Mock Interview${s.role ? ` — ${s.role}` : ""}`
                      : `Guidance${s.topic ? ` — ${s.topic}` : ""}`}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {rec && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rec.color}`}
                    >
                      {rec.text}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(s.scheduledTime).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>

              {isInterview &&
                (f.technicalDepth ||
                  f.problemSolving ||
                  f.communication ||
                  f.confidence) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2 mb-2 sm:mb-3">
                    {f.technicalDepth && (
                      <RatingBar label="Technical" value={f.technicalDepth} />
                    )}
                    {f.problemSolving && (
                      <RatingBar
                        label="Problem Solving"
                        value={f.problemSolving}
                      />
                    )}
                    {f.communication && (
                      <RatingBar
                        label="Communication"
                        value={f.communication}
                      />
                    )}
                    {f.confidence && (
                      <RatingBar label="Confidence" value={f.confidence} />
                    )}
                  </div>
                )}

              {(f.summary || f.strengths) && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">
                  {f.summary || f.strengths}
                </p>
              )}

              <Link href={`/student/feedback/${s.id}`}>
                <span className="text-xs text-indigo-600 hover:underline font-medium cursor-pointer">
                  Read full feedback →
                </span>
              </Link>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Profile Completion Bar ───────────────────────────────────────────────────

function ProfileCompletionBar({ profile }: { profile: Profile }) {
  const fields = [
    profile.name,
    profile.college,
    profile.branch,
    profile.graduationYear,
    profile.targetRole,
    profile.experienceLevel,
    profile.resumeUrl,
  ];
  const pct = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  if (pct === 100) return null;

  return (
    <div className="theme-surface-subtle flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 mb-4 sm:mb-5">
      <div className="flex-1">
        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5">
          <span className="font-medium">Profile completion</span>
          <span className="text-indigo-600 font-semibold">{pct}%</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
          <div
            className="h-1.5 bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function StudentDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Loading your dashboard…</p>
          </div>
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Auto-open upgrade modal if ?upgrade=1 (triggered from sidebar)
  useEffect(() => {
    if (searchParams.get("upgrade") === "1") {
      setShowUpgrade(true);
      router.replace("/student/dashboard");
    }
  }, [searchParams]);

  const [formData, setFormData] = useState({
    name: "",
    college: "",
    branch: "",
    graduationYear: "",
    targetRole: "",
    targetRoleCustom: "",
    experienceLevel: "",
  });

  useEffect(() => {
    fetchData();
    const onSaved = () => fetchData();
    window.addEventListener("profile-saved", onSaved);
    return () => window.removeEventListener("profile-saved", onSaved);
  }, []);

  const fetchData = async () => {
    try {
      const [profileRes, sessionsRes] = await Promise.all([
        fetch("/api/student/profile"),
        fetch("/api/student/sessions"),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setUser(data.user);
        setProfile(data.profile);
        if (data.profile) {
          const knownRole = targetRoleOptions.some(
            (opt) => opt.value === data.profile.targetRole && opt.value !== ""
          );
          setFormData({
            name: data.profile.name || "",
            college: data.profile.college || "",
            branch: data.profile.branch || "",
            graduationYear: data.profile.graduationYear?.toString() || "",
            targetRole: knownRole
              ? data.profile.targetRole || ""
              : data.profile.targetRole
              ? "Other"
              : "",
            targetRoleCustom: knownRole ? "" : data.profile.targetRole || "",
            experienceLevel: data.profile.experienceLevel || "",
          });
        } else {
          setEditing(true);
        }
      }
      if (sessionsRes.ok) {
        const d = await sessionsRes.json();
        setSessions(d.sessions || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        targetRole:
          formData.targetRole === "Other"
            ? formData.targetRoleCustom.trim() || ""
            : formData.targetRole,
      };

      const res = await fetch("/api/student/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchData();
        setEditing(false);
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setResumeError("Please upload a PDF, DOC, or DOCX file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResumeError("File size must be less than 5MB");
      return;
    }
    setResumeError("");
    setUploadingResume(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch("/api/student/upload-resume", {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        await fetchData();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        const d = await res.json();
        setResumeError(d.error || "Failed to upload resume");
      }
    } catch {
      setResumeError("Failed to upload resume");
    } finally {
      setUploadingResume(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!confirm("Are you sure you want to delete your resume?")) return;
    try {
      const res = await fetch("/api/student/upload-resume", {
        method: "DELETE",
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error("Failed to delete resume:", err);
    }
  };

  const handlePaymentSuccess = () => {
    setShowUpgrade(false);
    fetchData();
  };

  const getResumeFileName = (url: string) => {
    if (!url) return "resume";
    return url.split("/").pop() || "resume";
  };

  const upcomingSessions = sessions.filter(
    (s) => s.status === "SCHEDULED" && new Date(s.scheduledTime) > new Date(),
  );
  const completedSessions = sessions.filter((s) => s.status === "COMPLETED");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const displayName =
    profile?.name || user?.name || user?.email?.split("@")[0] || "Student";

  // ── Upgrade screen ─────────────────────────────────────────────────────────
  if (showUpgrade && profile) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <button
            onClick={() => setShowUpgrade(false)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Upgrade to Pro
          </h1>
        </div>
        <PaymentGate
          planType={profile.planType}
          used={Math.max(profile.interviewsUsed, profile.guidanceUsed)}
          limit={Math.max(profile.interviewsLimit, profile.guidanceLimit)}
          sessionType="interview"
          onPaymentSuccessAction={handlePaymentSuccess}
        />
      </div>
    );
  }

  // ── Main Dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Page title ── */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">
          Welcome back, {displayName}! 👋
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
          Here's an overview of your interview prep journey.
        </p>
      </div>

      {/* ── Profile Section ── */}
      <Card variant="elevated" className="theme-surface-card p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg sm:text-2xl font-display font-semibold text-slate-900 dark:text-white">
            Your Profile
          </h2>
        </div>

        {/* Profile completion bar */}
        {profile && !editing && <ProfileCompletionBar profile={profile} />}

        {editing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Input
                label="Full Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
              <Input
                label="College/University"
                value={formData.college}
                onChange={(e) =>
                  setFormData({ ...formData, college: e.target.value })
                }
              />
              <Input
                label="Branch/Major"
                value={formData.branch}
                onChange={(e) =>
                  setFormData({ ...formData, branch: e.target.value })
                }
              />
              <Input
                label="Graduation Year"
                value={formData.graduationYear}
                onChange={(e) =>
                  setFormData({ ...formData, graduationYear: e.target.value })
                }
                type="number"
              />
              <Select
                label="Target Role"
                value={formData.targetRole}
                onChange={(e) => {
                  const selected = e.target.value;
                  if (selected === "Other") {
                    setFormData({
                      ...formData,
                      targetRole: "Other",
                      targetRoleCustom: "",
                    });
                  } else {
                    setFormData({
                      ...formData,
                      targetRole: selected,
                      targetRoleCustom: "",
                    });
                  }
                }}
                options={targetRoleOptions}
                required
              />
              {formData.targetRole === "Other" && (
                <Input
                  label="Specify target role"
                  value={formData.targetRoleCustom}
                  onChange={(e) =>
                    setFormData({ ...formData, targetRoleCustom: e.target.value })
                  }
                  required
                />
              )}
              <Select
                label="Experience Level"
                value={formData.experienceLevel}
                onChange={(e) =>
                  setFormData({ ...formData, experienceLevel: e.target.value })
                }
                options={experienceLevelOptions}
                required
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" className="w-full sm:w-auto">
                Save Profile
              </Button>
              {profile && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : profile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {[
              { label: "College", value: profile.college },
              { label: "Branch", value: profile.branch },
              { label: "Graduation Year", value: profile.graduationYear },
              { label: "Target Role", value: profile.targetRole },
              { label: "Experience Level", value: profile.experienceLevel },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="theme-surface-subtle p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                <p className="font-semibold text-slate-900 dark:text-white text-sm break-words">
                  {value || (
                    <span className="text-slate-400 italic font-normal">
                      Not set
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {/* ── Resume Upload ── */}
        {profile && (
          <div
            id="resume"
            className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-200 dark:border-white/10"
          >
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
              Resume
            </h3>
            {profile.resumeUrl ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border-2 border-green-200 dark:border-green-400/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-xl flex items-center justify-center text-white shrink-0">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">
                      Resume uploaded ✅
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 truncate">
                      {getResumeFileName(profile.resumeUrl)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={
                      profile.resumeUrl
                        ? getCloudinaryPreviewUrl(profile.resumeUrl)
                        : "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      if (profile.resumeUrl) {
                        window.open(
                          getCloudinaryPreviewUrl(profile.resumeUrl),
                          "_blank",
                        );
                      }
                    }}
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-xs sm:text-sm font-medium"
                  >
                    View
                  </a>
                  <button
                    onClick={handleDeleteResume}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs sm:text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 dark:border-white/15 rounded-xl p-6 sm:p-8 text-center hover:border-indigo-400 dark:hover:border-indigo-400/40 transition-colors">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-100 dark:bg-indigo-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white mb-1">
                  Upload your resume
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">
                  PDF, DOC, or DOCX · Max 5MB
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
                <Button
                  type="button"
                  disabled={uploadingResume}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingResume ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Uploading…
                    </span>
                  ) : (
                    "Choose File"
                  )}
                </Button>
                {resumeError && (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-300 mt-2">
                    {resumeError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Subscription Card ── */}
      {profile && <SubscriptionCard profile={profile} />}

      {/* ── Readiness Score ── */}
      {profile && <ReadinessCard profile={profile} sessions={sessions} />}

      {/* ── Next Action Banner ── */}
      {profile && <NextActionBanner profile={profile} sessions={sessions} />}

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-5 mb-4 sm:mb-6">
        <Card variant="bordered" className="theme-surface-card p-3 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 dark:bg-indigo-500/15 rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0">
              📅
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-indigo-600">
                {upcomingSessions.length}
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">Upcoming</p>
            </div>
          </div>
        </Card>
        <Card variant="bordered" className="theme-surface-card p-3 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-500/15 rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0">
              ✅
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                {completedSessions.length}
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">Completed</p>
            </div>
          </div>
        </Card>
        <Card variant="bordered" className="theme-surface-card p-3 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-violet-100 dark:bg-violet-500/15 rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0">
              🗂️
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-violet-600">
                {sessions.length}
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">Total</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Recent Feedback ── */}
      <RecentFeedbackCard sessions={sessions} />

      {/* ── Quick Actions ── */}
      <Card variant="elevated" className="theme-surface-card p-4 sm:p-6 lg:p-8">
        <h2 className="text-lg sm:text-2xl font-display font-semibold text-slate-900 dark:text-white mb-4 sm:mb-5">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Link href="/student/book-guidance">
            <div className="p-4 sm:p-6 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 border-2 border-indigo-200 dark:border-indigo-400/20 rounded-xl hover:shadow-lg transition-all cursor-pointer group">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🎓</div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1 text-sm sm:text-base">
                Book Guidance Session
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Get mentorship from industry experts
              </p>
              {profile && (
                <p className="text-xs text-indigo-600 mt-2 font-semibold">
                  {profile.guidanceLimit - profile.guidanceUsed} sessions
                  remaining
                </p>
              )}
            </div>
          </Link>

          <Link href="/student/book-interview">
            <div className="p-4 sm:p-6 bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-500/10 dark:to-pink-500/10 border-2 border-violet-200 dark:border-violet-400/20 rounded-xl hover:shadow-lg transition-all cursor-pointer group">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">💼</div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1 text-sm sm:text-base">
                Book Mock Interview
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Practice with realistic interview scenarios
              </p>
              {profile && (
                <p className="text-xs text-violet-600 mt-2 font-semibold">
                  {profile.interviewsLimit - profile.interviewsUsed} interviews
                  remaining
                </p>
              )}
            </div>
          </Link>

          <Link href="/student/sessions">
            <div className="p-4 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border-2 border-green-200 dark:border-green-400/20 rounded-xl hover:shadow-lg transition-all cursor-pointer group">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">📅</div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1 text-sm sm:text-base">
                My Sessions
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                View your complete session history
              </p>
              {sessions.length > 0 && (
                <p className="text-xs text-green-600 mt-2 font-semibold">
                  {sessions.length} total session
                  {sessions.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </Link>
          
          <div
            className="p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/[0.03] border-2 border-slate-200 dark:border-white/10 rounded-xl hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => setShowUpgrade(true)}
          >
            <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">⭐</div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1 text-sm sm:text-base">
              Upgrade to Pro
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Unlock more sessions &amp; priority mentors
            </p>
            <p className="text-xs text-indigo-600 mt-2 font-semibold">
              Only ₹99/mo
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
