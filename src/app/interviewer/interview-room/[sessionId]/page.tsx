"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface ChatMessage {
  id: string;
  sender: "student" | "interviewer" | "system";
  senderName: string;
  text: string;
  timestamp: Date;
}

interface BehaviorReport {
  score: number;
  flag: "green" | "yellow" | "red";
  summary: string;
  issues: string[];
}

export default function InterviewerInterviewRoom() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const behaviorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const processedCandidates = useRef<Set<string>>(new Set());
  const processedMessages = useRef<Set<string>>(new Set());
  const hasCreatedAnswer = useRef(false);

  const [userName, setUserName] = useState("Interviewer");
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [duration, setDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "waiting" | "connecting" | "connected" | "disconnected"
  >("waiting");

  // Notes state
  const [rawNotes, setRawNotes] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesTab, setNotesTab] = useState<"raw" | "ai">("raw");
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Behavior monitoring state
  const [behaviorReport, setBehaviorReport] = useState<BehaviorReport | null>(null);
  const [isBehaviorOpen, setIsBehaviorOpen] = useState(false);
  const [analyzingBehavior, setAnalyzingBehavior] = useState(false);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState(0);

  // Load session info for context
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const name =
          data?.profile?.name ||
          data?.user?.name ||
          data?.user?.email?.split("@")[0] ||
          "Interviewer";
        setUserName(name);
      })
      .catch(() => {});

    fetch("/api/interviewer/sessions")
      .then((r) => r.json())
      .then((data) => {
        const found = data.sessions?.find(
          (s: any) => s.id === parseInt(sessionId),
        );
        if (found) setSessionInfo(found);
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto behavior analysis every 2 minutes when connected
  useEffect(() => {
    if (connectionStatus === "connected") {
      behaviorTimerRef.current = setInterval(() => {
        const interviewerMsgCount = chatMessages.filter(
          (m) => m.sender === "interviewer",
        ).length;
        // Only re-analyze if new messages since last analysis
        if (interviewerMsgCount > lastAnalyzedCount && interviewerMsgCount >= 3) {
          runBehaviorAnalysis(false);
        }
      }, 120_000); // every 2 minutes
    }
    return () => {
      if (behaviorTimerRef.current) clearInterval(behaviorTimerRef.current);
    };
  }, [connectionStatus, chatMessages, lastAnalyzedCount]);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0)
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const addSystemMessage = useCallback((text: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        sender: "system",
        senderName: "System",
        text,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const pollRoom = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/interview-room?sessionId=${sessionId}&role=interviewer`,
      );
      if (!res.ok) return;
      const data = await res.json();

      for (const msg of data.messages ?? []) {
        if (!processedMessages.current.has(msg.id)) {
          processedMessages.current.add(msg.id);
          if (msg.sender !== "interviewer") {
            setChatMessages((prev) => [
              ...prev,
              {
                id: msg.id,
                sender: msg.sender,
                senderName: msg.senderName,
                text: msg.text,
                timestamp: new Date(msg.timestamp),
              },
            ]);
          }
        }
      }

      if (!pcRef.current) return;

      if (
        data.offer &&
        !hasCreatedAnswer.current &&
        pcRef.current.signalingState === "stable"
      ) {
        hasCreatedAnswer.current = true;
        setConnectionStatus("connecting");
        addSystemMessage("Student connected, establishing connection…");
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(data.offer),
        );
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        await fetch("/api/interview-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            action: "answer",
            role: "interviewer",
            answer: pcRef.current.localDescription,
          }),
        });
      }

      if (data.studentCandidates && pcRef.current.remoteDescription) {
        for (const candidate of data.studentCandidates) {
          const key = JSON.stringify(candidate);
          if (!processedCandidates.current.has(key)) {
            processedCandidates.current.add(key);
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {}
          }
        }
      }
    } catch {}
  }, [sessionId, addSystemMessage]);

  const initPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    pcRef.current = pc;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch {
      addSystemMessage(
        "Could not access camera/microphone. Check browser permissions.",
      );
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteStream(true);
        setConnectionStatus("connected");
        addSystemMessage("Student video/audio connected!");
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setConnectionStatus("disconnected");
        setRemoteStream(false);
        addSystemMessage("Student disconnected.");
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await fetch("/api/interview-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            action: "ice-candidate",
            role: "interviewer",
            candidate: event.candidate.toJSON(),
          }),
        });
      }
    };

    addSystemMessage("Waiting for student to join…");
    pollingRef.current = setInterval(pollRoom, 1500);
  }, [sessionId, addSystemMessage, pollRoom]);

  useEffect(() => {
    initPeerConnection();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (behaviorTimerRef.current) clearInterval(behaviorTimerRef.current);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
  }, [initPeerConnection]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMicOn(track.enabled);
    }
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsCameraOn(track.enabled);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");

    const res = await fetch("/api/interview-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        action: "message",
        role: "interviewer",
        senderName: userName,
        text,
      }),
    });

    const data = await res.json();
    if (data.message?.id) processedMessages.current.add(data.message.id);

    setChatMessages((prev) => [
      ...prev,
      {
        id: data.message?.id || `local-${Date.now()}`,
        sender: "interviewer",
        senderName: "You",
        text,
        timestamp: new Date(),
      },
    ]);
  };

  // ── Generate AI structured notes ──────────────────────────────────────────
  const generateAINotes = async () => {
    setGeneratingNotes(true);
    try {
      const res = await fetch("/api/ai/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-notes",
          sessionId,
          notes: rawNotes,
          chatMessages: chatMessages.filter((m) => m.sender !== "system"),
          sessionInfo: {
            studentName: sessionInfo?.student?.name || "Student",
            role: sessionInfo?.role || "General",
            difficulty: sessionInfo?.difficulty || "N/A",
            interviewType: sessionInfo?.interviewType || "Technical",
            duration: formatDuration(duration),
          },
        }),
      });
      const data = await res.json();
      if (data.notes) {
        setAiNotes(data.notes);
        setNotesTab("ai");
      }
    } catch (err) {
      console.error("Failed to generate notes:", err);
    } finally {
      setGeneratingNotes(false);
    }
  };

  // ── Run behavior analysis ─────────────────────────────────────────────────
  const runBehaviorAnalysis = async (manual = true) => {
    if (manual) setAnalyzingBehavior(true);
    try {
      const interviewerMsgs = chatMessages.filter((m) => m.sender === "interviewer");
      setLastAnalyzedCount(interviewerMsgs.length);

      const res = await fetch("/api/ai/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze-behavior",
          sessionId,
          chatMessages: chatMessages.filter((m) => m.sender !== "system"),
        }),
      });
      const data = await res.json();
      if (data.score !== undefined) {
        setBehaviorReport(data);
        if (manual) setIsBehaviorOpen(true);
        // Auto-open if red flag detected
        if (data.flag === "red" && !manual) {
          setIsBehaviorOpen(true);
          addSystemMessage("⚠️ Admin alert: Behavior concern detected.");
        }
      }
    } catch (err) {
      console.error("Behavior analysis failed:", err);
    } finally {
      if (manual) setAnalyzingBehavior(false);
    }
  };

  const endCall = async () => {
    // Run final behavior analysis before leaving
    await runBehaviorAnalysis(false);
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (behaviorTimerRef.current) clearInterval(behaviorTimerRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    router.push(`/interviewer/sessions`);
  };

  const flagColor = {
    green: "text-green-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
  };
  const flagBg = {
    green: "bg-green-500/10 border-green-500/30",
    yellow: "bg-yellow-500/10 border-yellow-500/30",
    red: "bg-red-500/10 border-red-500/30",
  };
  const flagEmoji = { green: "✅", yellow: "⚠️", red: "🚨" };

  const statusColors = {
    waiting: "bg-yellow-500",
    connecting: "bg-blue-500",
    connected: "bg-green-500",
    disconnected: "bg-red-500",
  };
  const statusLabels = {
    waiting: "Waiting for Student",
    connecting: "Connecting…",
    connected: "Live",
    disconnected: "Disconnected",
  };

  return (
    <div
      className="flex h-screen bg-gray-950 text-white overflow-hidden"
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <div className="flex flex-col flex-1 min-w-0">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                <CamOnIcon />
              </div>
              <span className="font-semibold text-sm">InterviewPrepLive</span>
            </div>
            <div className="h-5 w-px bg-gray-700" />
            <span className="text-xs text-gray-400 font-mono">
              Session #{sessionId}
            </span>
            <div className="bg-amber-500/20 border border-amber-500/40 rounded-full px-2.5 py-0.5">
              <span className="text-xs text-amber-400 font-medium">
                Interviewer View
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-800 rounded-full px-3 py-1.5">
              <span
                className={`w-2 h-2 rounded-full ${statusColors[connectionStatus]} ${connectionStatus === "connected" ? "animate-pulse" : ""}`}
              />
              <span className="text-xs font-medium text-gray-300">
                {statusLabels[connectionStatus]}
              </span>
            </div>
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-1.5 bg-gray-800 rounded-full px-3 py-1.5">
                <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-mono text-violet-300">
                  {formatDuration(duration)}
                </span>
              </div>
            )}
            {/* Behavior monitor button */}
            {behaviorReport && (
              <button
                onClick={() => setIsBehaviorOpen((o) => !o)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${flagBg[behaviorReport.flag]} ${flagColor[behaviorReport.flag]}`}
              >
                <span>{flagEmoji[behaviorReport.flag]}</span>
                Conduct: {behaviorReport.score}/100
              </button>
            )}
            {/* Notes button */}
            <button
              onClick={() => setIsNotesOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${isNotesOpen ? "bg-amber-500/20 border border-amber-500/40 text-amber-400" : "bg-gray-800 text-gray-400 hover:text-white"}`}
            >
              <NoteIcon />
              Notes
            </button>
          </div>
        </div>

        {/* ── Video area ── */}
        <div className="flex-1 relative bg-gray-950 p-4">
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gray-900 border border-gray-800">
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center text-3xl font-bold">S</div>
                  <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-gray-300 font-medium">Student</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {connectionStatus === "waiting" ? "Waiting to join…" : connectionStatus === "connecting" ? "Connecting…" : "Disconnected"}
                  </p>
                </div>
                {connectionStatus === "waiting" && (
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {remoteStream && (
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium">Student</span>
              </div>
            )}
          </div>

          {/* PiP */}
          <div className="absolute bottom-8 right-8 w-48 h-36 rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl bg-gray-800">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!isCameraOn && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-sm font-bold">
                  {userName[0]?.toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 rounded px-2 py-0.5">
              <span className="text-xs">You</span>
            </div>
          </div>

          {/* ── AI NOTES PANEL ── */}
          {isNotesOpen && (
            <div className="absolute top-6 left-6 w-80 bg-gray-900/97 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100%-48px)]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <NoteIcon className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">Interview Notes</span>
                </div>
                <button onClick={() => setIsNotesOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <CloseIcon />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-700 flex-shrink-0">
                <button
                  onClick={() => setNotesTab("raw")}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${notesTab === "raw" ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-500 hover:text-gray-300"}`}
                >
                  My Notes
                </button>
                <button
                  onClick={() => setNotesTab("ai")}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${notesTab === "ai" ? "text-violet-400 border-b-2 border-violet-400" : "text-gray-500 hover:text-gray-300"}`}
                >
                  <SparkleIcon />
                  AI Notes
                  {aiNotes && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 ml-0.5" />}
                </button>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-3 min-h-0">
                {notesTab === "raw" ? (
                  <div className="flex flex-col h-full gap-2">
                    <textarea
                      value={rawNotes}
                      onChange={(e) => { setRawNotes(e.target.value); setNotesSaved(false); }}
                      placeholder={"Jot down quick notes during the interview…\n\n• Technical skills observed\n• Communication style\n• Key moments\n• Questions asked"}
                      className="w-full flex-1 min-h-[180px] bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
                    />
                    <p className="text-xs text-gray-600">Private — only visible to you</p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {aiNotes ? (
                      aiNotes
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                          <SparkleIcon className="w-6 h-6 text-violet-400" />
                        </div>
                        <p className="text-gray-500 text-xs leading-relaxed">
                          AI will generate structured notes<br/>based on your notes + chat transcript
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Generate button */}
              <div className="p-3 border-t border-gray-700 flex-shrink-0">
                <button
                  onClick={generateAINotes}
                  disabled={generatingNotes}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                             bg-gradient-to-r from-violet-600 to-indigo-600
                             hover:from-violet-500 hover:to-indigo-500
                             disabled:opacity-50 disabled:cursor-not-allowed
                             text-white text-xs font-semibold transition-all"
                >
                  {generatingNotes ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating AI Notes…
                    </>
                  ) : (
                    <>
                      <SparkleIcon className="w-3.5 h-3.5" />
                      Generate AI Notes for Admin
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── BEHAVIOR MONITOR PANEL ── */}
          {isBehaviorOpen && (
            <div className="absolute top-6 right-6 w-72 bg-gray-900/97 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <ShieldIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-blue-400">Conduct Monitor</span>
                </div>
                <button onClick={() => setIsBehaviorOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <CloseIcon />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {behaviorReport ? (
                  <>
                    {/* Score ring */}
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg ${
                        behaviorReport.flag === 'green' ? 'border-green-500 text-green-400' :
                        behaviorReport.flag === 'yellow' ? 'border-yellow-500 text-yellow-400' :
                        'border-red-500 text-red-400'
                      }`}>
                        {behaviorReport.score}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${flagColor[behaviorReport.flag]}`}>
                          {flagEmoji[behaviorReport.flag]} {behaviorReport.flag === 'green' ? 'Professional' : behaviorReport.flag === 'yellow' ? 'Caution' : 'Alert'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">Conduct Score</p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className={`rounded-xl p-3 border text-xs text-gray-300 leading-relaxed ${flagBg[behaviorReport.flag]}`}>
                      {behaviorReport.summary}
                    </div>

                    {/* Issues */}
                    {behaviorReport.issues.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Issues Flagged</p>
                        {behaviorReport.issues.map((issue, i) => (
                          <div key={i} className="flex gap-2 text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2">
                            <span className="flex-shrink-0">•</span>
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-gray-600 text-center">
                      Auto-updates every 2 min · Admin can view this report
                    </p>
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No analysis yet. Send a few messages first.
                  </div>
                )}

                {/* Manual analyze button */}
                <button
                  onClick={() => runBehaviorAnalysis(true)}
                  disabled={analyzingBehavior}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl
                             bg-blue-600/20 border border-blue-600/30 hover:bg-blue-600/30
                             text-blue-400 text-xs font-semibold transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analyzingBehavior ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <ShieldIcon className="w-3.5 h-3.5" />
                      Analyze Now
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ── */}
        <div className="bg-gray-900 border-t border-gray-800 px-6 py-4 flex items-center justify-center gap-4">
          <ControlBtn on={isMicOn} onClick={toggleMic} onIcon={<MicOnIcon />} offIcon={<MicOffIcon />} title={isMicOn ? "Mute" : "Unmute"} />
          <ControlBtn on={isCameraOn} onClick={toggleCamera} onIcon={<CamOnIcon />} offIcon={<CamOffIcon />} title={isCameraOn ? "Turn off camera" : "Turn on camera"} />
          <button
            onClick={() => setIsChatOpen((o) => !o)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 ${isChatOpen ? "bg-amber-600" : "bg-gray-700 hover:bg-gray-600"}`}
            title="Toggle chat"
          >
            <ChatIcon />
          </button>
          {/* Conduct monitor button in controls */}
          <button
            onClick={() => { setIsBehaviorOpen((o) => !o); if (!behaviorReport) runBehaviorAnalysis(true); }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 ${
              isBehaviorOpen ? "bg-blue-600" :
              behaviorReport?.flag === "red" ? "bg-red-500/20 border border-red-500 text-red-400" :
              behaviorReport?.flag === "yellow" ? "bg-yellow-500/20 border border-yellow-500 text-yellow-400" :
              "bg-gray-700 hover:bg-gray-600"
            }`}
            title="Conduct Monitor"
          >
            <ShieldIcon />
          </button>
          <button
            onClick={endCall}
            className="flex items-center gap-2 h-12 rounded-full bg-red-600 hover:bg-red-700 px-6 font-medium text-sm transition-all hover:scale-105 ml-4"
            title="End session"
          >
            <EndCallIcon />
            End Session
          </button>
        </div>
      </div>

      {isChatOpen && (
        <ChatPanel
          messages={chatMessages}
          input={chatInput}
          onInput={setChatInput}
          onSend={sendMessage}
          onClose={() => setIsChatOpen(false)}
          senderRole="interviewer"
          bottomRef={chatBottomRef}
          accentClass="bg-amber-600"
          inputFocusClass="focus:border-amber-500"
        />
      )}
    </div>
  );
}

// ─── Reusable components ──────────────────────────────────────────────────────

function ControlBtn({ on, onClick, onIcon, offIcon, title }: {
  on: boolean; onClick: () => void;
  onIcon: React.ReactNode; offIcon: React.ReactNode; title: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 ${on ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-red-500/20 border border-red-500 text-red-400"}`}>
      {on ? onIcon : offIcon}
    </button>
  );
}

interface ChatPanelProps {
  messages: ChatMessage[]; input: string;
  onInput: (v: string) => void; onSend: () => void; onClose: () => void;
  senderRole: "student" | "interviewer";
  bottomRef: React.RefObject<HTMLDivElement>;
  accentClass: string; inputFocusClass: string;
}
function ChatPanel({ messages, input, onInput, onSend, onClose, senderRole, bottomRef, accentClass, inputFocusClass }: ChatPanelProps) {
  return (
    <div className="w-80 flex flex-col bg-gray-900 border-l border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChatIcon className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">Live Chat</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors"><CloseIcon /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
              <ChatIcon className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm">Chat will appear here</p>
          </div>
        )}
        {messages.map((msg) =>
          msg.sender === "system" ? (
            <div key={msg.id} className="flex justify-center">
              <div className="bg-gray-800 rounded-full px-3 py-1">
                <span className="text-xs text-gray-400">{msg.text}</span>
              </div>
            </div>
          ) : (
            <div key={msg.id} className={`flex flex-col gap-1 ${msg.sender === senderRole ? "items-end" : "items-start"}`}>
              <span className="text-xs text-gray-500 px-1">{msg.sender === senderRole ? "You" : msg.senderName}</span>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${msg.sender === senderRole ? `${accentClass} text-white rounded-tr-sm` : "bg-gray-800 text-gray-100 rounded-tl-sm"}`}>
                {msg.text}
              </div>
              <span className="text-xs text-gray-600 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder="Type a message…"
            className={`flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors ${inputFocusClass}`}
          />
          <button onClick={onSend} disabled={!input.trim()}
            className={`w-9 h-9 rounded-xl ${accentClass} hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105`}>
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const MicOnIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>);
const MicOffIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>);
const CamOnIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>);
const CamOffIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>);
const ChatIcon = ({ className = "w-5 h-5" }: { className?: string }) => (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>);
const SendIcon = () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>);
const EndCallIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" /></svg>);
const NoteIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>);
const CloseIcon = () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const SparkleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>);
const ShieldIcon = ({ className = "w-5 h-5" }: { className?: string }) => (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>);