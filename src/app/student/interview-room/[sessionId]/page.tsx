'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ChatMessage {
  id: string;
  sender: 'student' | 'interviewer' | 'system';
  senderName: string;
  text: string;
  timestamp: Date;
}

export default function StudentInterviewRoom() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const processedCandidates = useRef<Set<string>>(new Set());
  const processedMessages = useRef<Set<string>>(new Set());

  const [userName, setUserName] = useState('Student');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [duration, setDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'waiting' | 'connecting' | 'connected' | 'disconnected'
  >('waiting');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        const name =
          data?.profile?.name ||
          data?.user?.name ||
          data?.user?.email?.split('@')[0] ||
          'Student';
        setUserName(name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0)
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const addSystemMessage = useCallback((text: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        sender: 'system',
        senderName: 'System',
        text,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const pollRoom = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/interview-room?sessionId=${sessionId}&role=student`
      );
      if (!res.ok) return;
      const data = await res.json();

      // New chat messages from server — skip own messages (already shown locally)
      for (const msg of data.messages ?? []) {
        if (!processedMessages.current.has(msg.id)) {
          processedMessages.current.add(msg.id);
          // Only add if it's from the other side (interviewer)
          if (msg.sender !== 'student') {
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
        data.answer &&
        pcRef.current.signalingState === 'have-local-offer'
      ) {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        setConnectionStatus('connecting');
      }

      if (data.iceCandidates && pcRef.current.remoteDescription) {
        for (const candidate of data.iceCandidates) {
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
  }, [sessionId]);

  const initPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
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
      addSystemMessage('Could not access camera/microphone. Check browser permissions.');
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteStream(true);
        setConnectionStatus('connected');
        addSystemMessage('Interviewer connected!');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('disconnected');
        setRemoteStream(false);
        addSystemMessage('Connection lost. Please refresh to reconnect.');
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await fetch('/api/interview-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            action: 'ice-candidate',
            role: 'student',
            candidate: event.candidate.toJSON(),
          }),
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await fetch('/api/interview-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: 'offer',
        role: 'student',
        offer: pc.localDescription,
      }),
    });

    addSystemMessage('Waiting for interviewer to join...');
    pollingRef.current = setInterval(pollRoom, 1500);
  }, [sessionId, addSystemMessage, pollRoom]);

  useEffect(() => {
    initPeerConnection();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
  }, [initPeerConnection]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMicOn(track.enabled); }
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsCameraOn(track.enabled); }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        await sender?.replaceTrack(videoTrack);
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenSharing(false);
      addSystemMessage('Screen sharing stopped.');
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        await sender?.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          const camTrack = localStreamRef.current?.getVideoTracks()[0];
          if (camTrack && pcRef.current) {
            const s = pcRef.current.getSenders().find((x) => x.track?.kind === 'video');
            s?.replaceTrack(camTrack);
          }
          if (localVideoRef.current && localStreamRef.current)
            localVideoRef.current.srcObject = localStreamRef.current;
          addSystemMessage('Screen sharing stopped.');
        };
        setIsScreenSharing(true);
        addSystemMessage('Screen sharing started.');
      } catch {
        addSystemMessage('Screen sharing cancelled.');
      }
    }
  };

  // ✅ Fixed: show own message immediately, mark as processed to avoid duplication
  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');

    const res = await fetch('/api/interview-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: 'message',
        role: 'student',
        senderName: userName,
        text,
      }),
    });

    const data = await res.json();

    // Mark server-assigned ID as processed so polling doesn't duplicate it
    if (data.message?.id) {
      processedMessages.current.add(data.message.id);
    }

    // Show own message immediately
    setChatMessages((prev) => [
      ...prev,
      {
        id: data.message?.id || `local-${Date.now()}`,
        sender: 'student',
        senderName: 'You',
        text,
        timestamp: new Date(),
      },
    ]);
  };

  const endCall = async () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    router.push('/student/sessions');
  };

  const statusColors = {
    waiting: 'bg-yellow-500',
    connecting: 'bg-blue-500',
    connected: 'bg-green-500',
    disconnected: 'bg-red-500',
  };
  const statusLabels = {
    waiting: 'Waiting for Interviewer',
    connecting: 'Connecting…',
    connected: 'Live',
    disconnected: 'Disconnected',
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                <CamOnIcon />
              </div>
              <span className="font-semibold text-sm">InterviewPrepLive</span>
            </div>
            <div className="h-5 w-px bg-gray-700" />
            <span className="text-xs text-gray-400 font-mono">Session #{sessionId}</span>
            <div className="bg-violet-500/20 border border-violet-500/40 rounded-full px-2.5 py-0.5">
              <span className="text-xs text-violet-400 font-medium">Student View</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-800 rounded-full px-3 py-1.5">
              <span className={`w-2 h-2 rounded-full ${statusColors[connectionStatus]} ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`} />
              <span className="text-xs font-medium text-gray-300">{statusLabels[connectionStatus]}</span>
            </div>
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-1.5 bg-gray-800 rounded-full px-3 py-1.5">
                <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-mono text-violet-300">{formatDuration(duration)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Video area */}
        <div className="flex-1 relative bg-gray-950 p-4">
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gray-900 border border-gray-800">
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center text-3xl font-bold">I</div>
                  {connectionStatus === 'waiting' && (
                    <div className="absolute inset-0 rounded-full border-2 border-violet-400 animate-ping opacity-40" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-gray-300 font-medium">Interviewer</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {connectionStatus === 'waiting' ? 'Waiting to join…' : connectionStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
                  </p>
                </div>
                {connectionStatus === 'waiting' && (
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {remoteStream && (
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium">Interviewer</span>
              </div>
            )}
          </div>

          {/* PiP */}
          <div className="absolute bottom-8 right-8 w-48 h-36 rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl bg-gray-800">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!isCameraOn && !isScreenSharing && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold">
                  {userName[0]?.toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 rounded px-2 py-0.5">
              <span className="text-xs">You</span>
            </div>
            {isScreenSharing && (
              <div className="absolute top-2 right-2 bg-blue-500 rounded px-1.5 py-0.5">
                <span className="text-xs font-medium">Sharing</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-900 border-t border-gray-800 px-6 py-4 flex items-center justify-center gap-4">
          <ControlBtn on={isMicOn} onClick={toggleMic} onIcon={<MicOnIcon />} offIcon={<MicOffIcon />} title={isMicOn ? 'Mute' : 'Unmute'} />
          <ControlBtn on={isCameraOn} onClick={toggleCamera} onIcon={<CamOnIcon />} offIcon={<CamOffIcon />} title={isCameraOn ? 'Turn off camera' : 'Turn on camera'} />
          <button onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
            <ScreenShareIcon />
          </button>
          <button onClick={() => setIsChatOpen((o) => !o)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 ${isChatOpen ? 'bg-violet-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            title="Toggle chat">
            <ChatIcon />
          </button>
          <button onClick={endCall}
            className="w-14 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all hover:scale-105 ml-4"
            title="Leave session">
            <EndCallIcon />
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
          senderRole="student"
          bottomRef={chatBottomRef}
          accentClass="bg-violet-600"
          inputFocusClass="focus:border-violet-500"
        />
      )}
    </div>
  );
}

// ─── Shared components & icons (same as before) ───────────────────────────────

function ControlBtn({ on, onClick, onIcon, offIcon, title }: {
  on: boolean; onClick: () => void; onIcon: React.ReactNode; offIcon: React.ReactNode; title: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 ${on ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500/20 border border-red-500 text-red-400'}`}>
      {on ? onIcon : offIcon}
    </button>
  );
}

interface ChatPanelProps {
  messages: ChatMessage[]; input: string; onInput: (v: string) => void;
  onSend: () => void; onClose: () => void; senderRole: 'student' | 'interviewer';
  bottomRef: React.RefObject<HTMLDivElement>; accentClass: string; inputFocusClass: string;
}
function ChatPanel({ messages, input, onInput, onSend, onClose, senderRole, bottomRef, accentClass, inputFocusClass }: ChatPanelProps) {
  return (
    <div className="w-80 flex flex-col bg-gray-900 border-l border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChatIcon className="w-4 h-4 text-violet-400" />
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
          msg.sender === 'system' ? (
            <div key={msg.id} className="flex justify-center">
              <div className="bg-gray-800 rounded-full px-3 py-1">
                <span className="text-xs text-gray-400">{msg.text}</span>
              </div>
            </div>
          ) : (
            <div key={msg.id} className={`flex flex-col gap-1 ${msg.sender === senderRole ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-gray-500 px-1">{msg.sender === senderRole ? 'You' : msg.senderName}</span>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${msg.sender === senderRole ? `${accentClass} text-white rounded-tr-sm` : 'bg-gray-800 text-gray-100 rounded-tl-sm'}`}>
                {msg.text}
              </div>
              <span className="text-xs text-gray-600 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
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

const MicOnIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>;
const MicOffIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>;
const CamOnIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const CamOffIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>;
const ScreenShareIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const ChatIcon = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const SendIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
const EndCallIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" /></svg>;
const CloseIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;