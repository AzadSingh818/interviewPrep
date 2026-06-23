'use client';

/**
 * src/components/LiveKitInterviewRoom.tsx
 *
 * Interview room component using LiveKit for signaling.
 * Replaces Postgres polling with real-time LiveKit transport.
 * Handles: video/audio streams, chat via DataChannel, connection status.
 */

import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { RemoteTrackPublication } from 'livekit-client';

interface LiveKitInterviewRoomProps {
  sessionId: string;
  token: string;
  wsUrl: string;
  roomName: string;
  participantName: string;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

/**
 * Simplified video layout component
 */
function ParticipantGrid({ participants }: { participants: any[] }) {
  const videoRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={videoRef}
      className="w-full h-full bg-gray-900 rounded-lg overflow-hidden"
    >
      <GridLayout tracks={participants.map((p) => ({ participant: p }))} />
    </div>
  );
}

/**
 * Connection status indicator
 */
function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
        connected
          ? 'bg-green-100 text-green-800'
          : 'bg-yellow-100 text-yellow-800'
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full ${connected ? 'bg-green-600' : 'bg-yellow-600'}`}
      />
      {connected ? 'Connected' : 'Connecting...'}
    </div>
  );
}

/**
 * Main LiveKit interview room component
 */
export default function LiveKitInterviewRoom({
  sessionId,
  token,
  wsUrl,
  roomName,
  participantName,
  onConnectionChange,
  onError,
}: LiveKitInterviewRoomProps) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback(
    (err: Error) => {
      console.error('LiveKit error:', err);
      setError(err);
      onError?.(err);
    },
    [onError]
  );

  const handleConnected = useCallback(() => {
    console.log('LiveKit room connected:', roomName);
    setConnected(true);
    onConnectionChange?.(true);
  }, [roomName, onConnectionChange]);

  const handleDisconnected = useCallback(() => {
    console.log('LiveKit room disconnected:', roomName);
    setConnected(false);
    onConnectionChange?.(false);
  }, [roomName, onConnectionChange]);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="text-red-600 font-semibold mb-2">Connection Error</div>
          <div className="text-gray-700 text-sm">{error.message}</div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex-shrink-0 flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
        <div className="text-white font-semibold">Session {sessionId}</div>
        <ConnectionStatus connected={connected} />
      </div>

      <div className="flex-1 relative overflow-hidden">
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl={wsUrl}
          roomName={roomName}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
          className="w-full h-full"
        >
          <VideoConference />
          <RoomAudioRenderer />
          <ControlBar />
        </LiveKitRoom>
      </div>
    </div>
  );
}
