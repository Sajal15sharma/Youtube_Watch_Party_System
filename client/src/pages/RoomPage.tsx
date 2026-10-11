import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { Header } from '../components/Header';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { VideoSelector } from '../components/VideoSelector';
import { ParticipantList } from '../components/ParticipantList';
import { Chat } from '../components/Chat';
import { RoleBadge } from '../components/RoleBadge';
import { Role } from '../types/index';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';

export const RoomPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  const cleanRoomCode = (roomCode || '').toUpperCase();

  // Synchronous session recovery from localStorage to prevent socket race conditions
  const [storedSession] = useState(() => {
    if (!cleanRoomCode) return null;
    const stored = localStorage.getItem(`yt_party_user_${cleanRoomCode}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [username, setUsername] = useState<string>(storedSession?.username || '');
  const [participantId, setParticipantId] = useState<string | undefined>(storedSession?.participantId);
  const [initialRole, setInitialRole] = useState<Role | undefined>(storedSession?.role as Role | undefined);
  const [namePrompt, setNamePrompt] = useState<string>('');
  const [hasPrompted, setHasPrompted] = useState<boolean>(!!storedSession?.username);


  const {
    isConnected,
    roomState,
    participants,
    currentUser,
    errorMessage,
    chatMessages,
    emitPlay,
    emitPause,
    emitSeek,
    emitChangeVideo,
    emitAssignRole,
    emitRemoveParticipant,
    emitTransferHost,
    emitChatMessage,
    emitHeartbeat,
    getServerTime,
    leaveRoom,
  } = useSocket(cleanRoomCode, username, participantId);

  const handleNamePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namePrompt.trim()) return;
    const cleanName = namePrompt.trim();
    setUsername(cleanName);
    setHasPrompted(true);
    localStorage.setItem(`yt_party_user_${cleanRoomCode}`, JSON.stringify({
      username: cleanName,
      role: 'PARTICIPANT',
    }));
  };

  // If user opened direct room link without entering username first
  if (!hasPrompted && !username) {
    return (
      <div className="page-wrapper">
        <Header />
        <main className="main-content flex-center">
          <div className="join-modal-card">
            <h2>Join Watch Party Room</h2>
            <p className="modal-subtitle">
              You are joining room <strong className="highlight">{cleanRoomCode}</strong>
            </p>
            <form onSubmit={handleNamePromptSubmit} className="action-form">
              <div className="form-group">
                <label htmlFor="join-name-prompt">Enter Your Name</label>
                <input
                  id="join-name-prompt"
                  type="text"
                  placeholder="e.g. Alex"
                  value={namePrompt}
                  onChange={(e) => setNamePrompt(e.target.value)}
                  maxLength={30}
                  autoFocus
                  required
                  className="form-input"
                />
              </div>
              <button type="submit" className="submit-action-btn join">
                Enter Watch Party
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }


  // Authoritative role from server currentUser takes precedence over initialRole
  const role: Role = currentUser?.role || initialRole || 'PARTICIPANT';

  if (!roomState) {
    return (
      <div className="page-wrapper">
        <Header
          roomCode={cleanRoomCode}
          role={role}
          username={username}
          onLeave={leaveRoom}
        />
        <main className="main-content flex-center">
          <div className="join-modal-card" style={{ textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
            <h2>Connecting to Room {cleanRoomCode}...</h2>
            <p className="modal-subtitle">Fetching authoritative room & video state...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <Header
        roomCode={cleanRoomCode}
        role={role}
        username={username}
        onLeave={leaveRoom}
      />

      <main className="room-layout-container">
        {errorMessage && (
          <div className="toast-error-banner">
            <AlertTriangle className="toast-icon" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="room-grid">
          {/* Main Primary Left Column (70%) */}
          <div className="primary-column">
            <div className="room-status-bar">
              <div className="status-connection">
                {isConnected ? (
                  <span className="online-indicator">
                    <Wifi className="indicator-icon" />
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="offline-indicator">
                    <WifiOff className="indicator-icon" />
                    <span>Reconnecting...</span>
                  </span>
                )}
              </div>

              <div className="user-role-notice">
                <span className="notice-text">Your Access Level:</span>
                <RoleBadge role={role} size="md" />
              </div>
            </div>

            {/* YouTube Player */}
            <YouTubePlayer
              videoId={roomState.currentVideoId}
              playState={roomState.currentPlaybackState}
              currentTime={roomState.currentPlaybackTime}
              lastUpdated={roomState.lastUpdated}
              userRole={role}
              onPlay={emitPlay}
              onPause={emitPause}
              onSeek={emitSeek}
              onHeartbeat={emitHeartbeat}
              getServerTime={getServerTime}
            />

            {/* Video Selector */}
            <VideoSelector
              currentVideoId={roomState.currentVideoId}
              userRole={role}
              onChangeVideo={emitChangeVideo}
            />
          </div>

          {/* Sidebar Right Column (30%) */}
          <div className="sidebar-column">
            <ParticipantList
              participants={participants}
              currentUser={currentUser}
              onAssignRole={emitAssignRole}
              onRemoveParticipant={emitRemoveParticipant}
              onTransferHost={emitTransferHost}
            />

            <Chat messages={chatMessages} onSendMessage={emitChatMessage} />
          </div>
        </div>
      </main>
    </div>
  );
};
