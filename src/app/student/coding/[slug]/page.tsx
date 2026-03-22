"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";

// Dynamic import for Monaco editor (no SSR)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: number;
  title: string;
  slug: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  category: string;
  tags: string[];
  constraints: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  testCases: Array<{
    input: string;
    expectedOutput: string;
    isHidden: boolean;
  }>;
  starterCode: { c: string; cpp: string; sql: string };
  hints: string[];
}

interface TestResult {
  testCase: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  runtime?: number;
  isHidden: boolean;
  stderr?: string;
}

interface SubmissionResult {
  status: string;
  testsPassed: number;
  totalTests: number;
  results: TestResult[];
  runtime?: number;
  memory?: number;
  errorOutput?: string;
  demo?: boolean;
}

type Language = "c" | "cpp" | "sql";
type TabType = "description" | "submissions" | "hints";
type OutputTab = "testResult" | "console";

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFF_CONFIG = {
  EASY: { label: "Easy", color: "text-emerald-400" },
  MEDIUM: { label: "Medium", color: "text-amber-400" },
  HARD: { label: "Hard", color: "text-red-400" },
};

const LANG_CONFIG: Record<
  Language,
  { label: string; monaco: string; icon: string }
> = {
  c: { label: "C", monaco: "c", icon: "🔵" },
  cpp: { label: "C++", monaco: "cpp", icon: "🟣" },
  sql: { label: "SQL", monaco: "sql", icon: "🟡" },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  ACCEPTED: {
    label: "Accepted",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    icon: "✓",
  },
  WRONG_ANSWER: {
    label: "Wrong Answer",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    icon: "✗",
  },
  TIME_LIMIT_EXCEEDED: {
    label: "Time Limit Exceeded",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    icon: "⏱",
  },
  RUNTIME_ERROR: {
    label: "Runtime Error",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    icon: "💥",
  },
  COMPILE_ERROR: {
    label: "Compile Error",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    icon: "⚠",
  },
  PENDING: {
    label: "Running...",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    icon: "⟳",
  },
};

// ─── Markdown-ish renderer (minimal) ─────────────────────────────────────────
function renderDescription(md: string) {
  return md
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-base font-semibold text-white mt-4 mb-2">$1</h2>',
    )
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-sm font-semibold text-gray-300 mt-3 mb-1">$1</h3>',
    )
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-white font-semibold">$1</strong>',
    )
    .replace(
      /`([^`]+)`/g,
      '<code class="text-violet-300 bg-violet-500/15 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>',
    )
    .replace(
      /```([^`]+)```/gs,
      '<pre class="bg-[#0d1117] rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto my-2 border border-white/8">$1</pre>',
    )
    .replace(
      /^• (.+)$/gm,
      '<li class="text-gray-300 text-sm ml-4 list-disc">$1</li>',
    )
    .replace(/\n\n/g, "<br/>")
    .replace(/\n/g, "<br/>");
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CodingProblemPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("description");
  const [outputTab, setOutputTab] = useState<OutputTab>("testResult");
  const [customInput, setCustomInput] = useState("");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [layoutMode, setLayoutMode] = useState<
    "split" | "wide-editor" | "wide-desc"
  >("split");
  const [editorHeight, setEditorHeight] = useState(400);
  const [prevSubmissions, setPrevSubmissions] = useState<any[]>([]);

  // Fetch question
  useEffect(() => {
    fetchQuestion();
  }, [slug]);

  const fetchQuestion = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coding/questions/${slug}`);
      if (!res.ok) {
        router.push("/student/coding");
        return;
      }
      const data = await res.json();
      setQuestion(data.question);
      setIsSolved(data.isSolved);
      setPrevSubmissions(data.submissions || []);
      // Set starter code for current language
      setCode(data.question.starterCode?.cpp || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Update code when language changes
  useEffect(() => {
    if (question) {
      setCode(question.starterCode[language] || "");
      setSubmission(null);
    }
  }, [language, question]);

  const handleRun = async () => {
    if (!question || !code.trim()) return;
    setRunning(true);
    setOutputTab("console");
    setConsoleOutput("Running code...");
    try {
      const res = await fetch("/api/coding/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, stdin: customInput }),
      });
      const data = await res.json();
      if (res.ok) {
        let out = "";
        if (data.error) out += `Stderr:\n${data.error}\n\n`;
        if (data.output) out += data.output;
        if (!out)
          out = data.success ? "(no output)" : "Program exited with error.";
        setConsoleOutput(out.trim());
      } else {
        setConsoleOutput(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setConsoleOutput(`Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!question || !code.trim()) return;
    setSubmitting(true);
    setSubmission({
      status: "PENDING",
      testsPassed: 0,
      totalTests: 0,
      results: [],
    });
    setOutputTab("testResult");
    try {
      const res = await fetch("/api/coding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, language, code }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmission(data);
        if (data.status === "ACCEPTED") {
          setIsSolved(true);
          fetchQuestion(); // refresh submissions list
        }
      } else {
        setSubmission(null);
        setConsoleOutput(`Error: ${data.error}`);
        setOutputTab("console");
      }
    } catch (err: any) {
      setSubmission(null);
      setConsoleOutput(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading problem...</p>
        </div>
      </div>
    );
  }

  if (!question) return null;

  const diff = DIFF_CONFIG[question.difficulty];
  const langConf = LANG_CONFIG[language];

  // Left panel width based on layout
  const leftWidth =
    layoutMode === "wide-editor"
      ? "w-1/4"
      : layoutMode === "wide-desc"
        ? "w-2/3"
        : "w-2/5";
  const rightWidth =
    layoutMode === "wide-editor"
      ? "w-3/4"
      : layoutMode === "wide-desc"
        ? "w-1/3"
        : "w-3/5";

  return (
    <div
      className="min-h-screen bg-[#0d1117] text-white flex flex-col"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* ── Top Bar ── */}
      <div className="h-12 bg-[#161b22] border-b border-white/8 flex items-center px-4 gap-4 shrink-0">
        {/* Back */}
        <Link
          href="/student/coding"
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="hidden sm:inline">Problems</span>
        </Link>

        <div className="w-px h-5 bg-white/10" />

        {/* Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-200 truncate">
            {question.title}
          </span>
          <span className={`text-xs font-semibold ${diff.color} shrink-0`}>
            {diff.label}
          </span>
          {isSolved && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
              ✓ Solved
            </span>
          )}
        </div>

        {/* Layout toggles */}
        <div className="hidden md:flex items-center gap-1 bg-black/30 rounded p-0.5">
          {(["wide-desc", "split", "wide-editor"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setLayoutMode(mode)}
              title={mode}
              className={`w-7 h-6 flex items-center justify-center rounded transition-colors ${layoutMode === mode ? "bg-violet-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              {mode === "wide-desc" && (
                <span className="text-[9px] font-bold">◧</span>
              )}
              {mode === "split" && (
                <span className="text-[9px] font-bold">◫</span>
              )}
              {mode === "wide-editor" && (
                <span className="text-[9px] font-bold">◨</span>
              )}
            </button>
          ))}
        </div>

        {/* Language selector */}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="px-2 py-1 bg-[#0d1117] border border-white/15 rounded text-xs text-gray-300 focus:outline-none focus:border-violet-500 transition-colors"
        >
          {(Object.keys(LANG_CONFIG) as Language[]).map((l) => (
            <option key={l} value={l}>
              {LANG_CONFIG[l].label}
            </option>
          ))}
        </select>

        {/* Run & Submit */}
        <button
          onClick={handleRun}
          disabled={running || submitting}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-300 bg-white/8 hover:bg-white/12 border border-white/10 rounded transition-all disabled:opacity-50"
        >
          {running ? (
            <svg
              className="w-3 h-3 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          Run
        </button>

        <button
          onClick={handleSubmit}
          disabled={submitting || running}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded transition-all disabled:opacity-50"
        >
          {submitting ? (
            <svg
              className="w-3 h-3 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : null}
          Submit
        </button>
      </div>

      {/* ── Main Body: Left + Right panels ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── LEFT: Problem description ── */}
        <div
          className={`${leftWidth} flex flex-col border-r border-white/8 min-w-0 transition-all duration-200`}
        >
          {/* Tabs */}
          <div className="flex border-b border-white/8 bg-[#161b22] shrink-0">
            {(["description", "submissions", "hints"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "text-white border-b-2 border-violet-500 bg-transparent"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab}
                {tab === "hints" && question.hints?.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 px-1 rounded">
                    {question.hints.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {/* Description Tab */}
            {activeTab === "description" && (
              <div>
                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {question.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-xs text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                    {question.category}
                  </span>
                </div>

                {/* Problem description */}
                <div
                  className="text-gray-300 leading-relaxed text-sm"
                  dangerouslySetInnerHTML={{
                    __html: renderDescription(question.description),
                  }}
                />

                {/* Examples */}
                {question.examples?.length > 0 && (
                  <div className="mt-5">
                    <h2 className="text-base font-semibold text-white mb-3">
                      Examples
                    </h2>
                    {question.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="mb-4 bg-[#161b22] rounded-lg border border-white/8 overflow-hidden"
                      >
                        <div className="px-3 py-1.5 border-b border-white/8 text-xs text-gray-500 font-medium">
                          Example {i + 1}
                        </div>
                        <div className="p-3 space-y-2">
                          <div>
                            <span className="text-xs text-gray-500 font-medium">
                              Input:{" "}
                            </span>
                            <code className="text-xs text-gray-200 font-mono">
                              {ex.input}
                            </code>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 font-medium">
                              Output:{" "}
                            </span>
                            <code className="text-xs text-gray-200 font-mono">
                              {ex.output}
                            </code>
                          </div>
                          {ex.explanation && (
                            <div>
                              <span className="text-xs text-gray-500 font-medium">
                                Explanation:{" "}
                              </span>
                              <span className="text-xs text-gray-300">
                                {ex.explanation}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Constraints */}
                {question.constraints && (
                  <div className="mt-4">
                    <h2 className="text-base font-semibold text-white mb-2">
                      Constraints
                    </h2>
                    <div className="bg-[#161b22] rounded-lg border border-white/8 p-3">
                      <div
                        className="text-sm text-gray-300 font-mono leading-loose"
                        dangerouslySetInnerHTML={{
                          __html: renderDescription(question.constraints),
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submissions Tab */}
            {activeTab === "submissions" && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">
                  Your Submissions
                </h3>
                {prevSubmissions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No submissions yet. Solve the problem!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {prevSubmissions.map((s: any) => {
                      const st =
                        STATUS_CONFIG[s.status] || STATUS_CONFIG["PENDING"];
                      return (
                        <div
                          key={s.id}
                          className={`p-3 rounded-lg border ${st.bg}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold ${st.color}`}>
                              {st.icon} {st.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(s.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span>{s.language?.toUpperCase()}</span>
                            <span>
                              {s.testsPassed}/{s.totalTests} tests
                            </span>
                            {s.runtime && <span>{s.runtime}ms</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Hints Tab */}
            {activeTab === "hints" && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <svg
                    className="w-4 h-4 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <span className="text-sm font-semibold text-amber-400">
                    Progressive Hints
                  </span>
                </div>
                {question.hints?.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No hints available for this problem.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {question.hints.map((hint, i) => (
                      <div key={i}>
                        {i < revealedHints ? (
                          <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg p-3">
                            <div className="text-xs text-amber-400 font-semibold mb-1">
                              Hint {i + 1}
                            </div>
                            <p className="text-sm text-gray-300">{hint}</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRevealedHints(i + 1)}
                            className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:border-amber-500/30 transition-all text-left"
                          >
                            🔒 Reveal Hint {i + 1}
                          </button>
                        )}
                      </div>
                    ))}
                    {revealedHints >= question.hints.length &&
                      question.hints.length > 0 && (
                        <p className="text-xs text-gray-600 text-center">
                          All hints revealed
                        </p>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Editor + Output ── */}
        <div
          className={`${rightWidth} flex flex-col min-w-0 transition-all duration-200`}
        >
          {/* Editor */}
          <div className="flex-1 min-h-0" style={{ minHeight: "300px" }}>
            <MonacoEditor
              height="100%"
              language={langConf.monaco}
              value={code}
              onChange={(val) => setCode(val || "")}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                fontLigatures: true,
                lineNumbers: "on",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "off",
                tabSize: 4,
                insertSpaces: true,
                bracketPairColorization: { enabled: true },
                automaticLayout: true,
                cursorSmoothCaretAnimation: "on",
                smoothScrolling: true,
                padding: { top: 12 },
              }}
            />
          </div>

          {/* Output Panel */}
          <div className="h-56 border-t border-white/8 bg-[#0d1117] flex flex-col shrink-0">
            {/* Output tabs */}
            <div className="flex items-center border-b border-white/8 bg-[#161b22] px-2 shrink-0">
              <button
                onClick={() => setOutputTab("testResult")}
                className={`px-3 py-2 text-xs font-medium transition-colors ${outputTab === "testResult" ? "text-white border-b-2 border-violet-500" : "text-gray-500 hover:text-gray-300"}`}
              >
                Test Results
              </button>
              <button
                onClick={() => setOutputTab("console")}
                className={`px-3 py-2 text-xs font-medium transition-colors ${outputTab === "console" ? "text-white border-b-2 border-violet-500" : "text-gray-500 hover:text-gray-300"}`}
              >
                Console
              </button>

              <div className="flex-1" />

              {/* Run button (mobile) */}
              <button
                onClick={handleRun}
                disabled={running || submitting}
                className="sm:hidden mr-2 px-2 py-1 text-xs text-gray-300 bg-white/8 border border-white/10 rounded disabled:opacity-50"
              >
                {running ? "..." : "▶ Run"}
              </button>
            </div>

            {/* Output content */}
            <div className="flex-1 overflow-y-auto p-3">
              {/* Test Result Tab */}
              {outputTab === "testResult" && (
                <>
                  {!submission && !submitting && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-600">
                      <svg
                        className="w-8 h-8 mb-2 opacity-40"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      <p className="text-xs">
                        Click Submit to run against all test cases
                      </p>
                    </div>
                  )}

                  {(submitting || submission?.status === "PENDING") && (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-gray-500">
                        Running test cases...
                      </p>
                    </div>
                  )}

                  {submission && submission.status !== "PENDING" && (
                    <div>
                      {/* Overall result */}
                      {(() => {
                        const st =
                          STATUS_CONFIG[submission.status] ||
                          STATUS_CONFIG["PENDING"];
                        return (
                          <div
                            className={`flex items-center justify-between p-3 rounded-lg border mb-3 ${st.bg}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${st.color}`}>
                                {st.icon} {st.label}
                              </span>
                              {submission.demo && (
                                <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                  Demo Mode
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span
                                className={`font-semibold ${submission.testsPassed === submission.totalTests ? "text-emerald-400" : "text-red-400"}`}
                              >
                                {submission.testsPassed}/{submission.totalTests}{" "}
                                passed
                              </span>
                              {submission.runtime && (
                                <span>{submission.runtime}ms</span>
                              )}
                              {submission.memory && (
                                <span>
                                  {Math.round(submission.memory / 1024)}MB
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Error output */}
                      {submission.errorOutput && (
                        <div className="mb-3 bg-red-500/8 border border-red-500/20 rounded-lg p-3">
                          <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                            {submission.errorOutput}
                          </p>
                        </div>
                      )}

                      {/* Individual test results */}
                      <div className="space-y-1.5">
                        {submission.results.map((r, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border text-xs ${r.passed ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}
                          >
                            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                              <span
                                className={
                                  r.passed ? "text-emerald-400" : "text-red-400"
                                }
                              >
                                {r.passed ? "✓" : "✗"}
                              </span>
                              <span className="text-gray-400">
                                {r.isHidden
                                  ? `Hidden Test ${r.testCase}`
                                  : `Test Case ${r.testCase}`}
                              </span>
                              {r.runtime && (
                                <span className="text-gray-600 ml-auto">
                                  {r.runtime}ms
                                </span>
                              )}
                            </div>
                            {!r.isHidden && !r.passed && (
                              <div className="px-3 pb-2 space-y-1 border-t border-white/5">
                                <div className="flex gap-2">
                                  <span className="text-gray-600 w-14 shrink-0">
                                    Input:
                                  </span>
                                  <code className="text-gray-300 font-mono">
                                    {r.input}
                                  </code>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-gray-600 w-14 shrink-0">
                                    Expected:
                                  </span>
                                  <code className="text-emerald-300 font-mono">
                                    {r.expectedOutput}
                                  </code>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-gray-600 w-14 shrink-0">
                                    Got:
                                  </span>
                                  <code className="text-red-300 font-mono">
                                    {r.actualOutput}
                                  </code>
                                </div>
                                {r.stderr && (
                                  <div className="flex gap-2">
                                    <span className="text-gray-600 w-14 shrink-0">
                                      Stderr:
                                    </span>
                                    <code className="text-orange-300 font-mono">
                                      {r.stderr}
                                    </code>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Console Tab */}
              {outputTab === "console" && (
                <div className="h-full flex flex-col gap-2">
                  {/* Custom input */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Custom Input
                    </label>
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Enter input for your program..."
                      className="w-full h-14 bg-[#161b22] border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none transition-colors"
                    />
                  </div>
                  {/* Output */}
                  <div className="flex-1 bg-[#161b22] rounded border border-white/8 p-2 overflow-y-auto">
                    <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                      {consoleOutput ||
                        (running
                          ? "Running..."
                          : "Run your code to see output here.")}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
