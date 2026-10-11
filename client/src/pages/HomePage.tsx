import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, getRoom } from '../services/api';
import { Header } from '../components/Header';
import { extractYouTubeVideoId } from '../utils/youtube';
import { PlusCircle, LogIn, ShieldCheck, Zap, Users, AlertCircle } from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Create Room state
  const [createUsername, setCreateUsername] = useState('');
  const [createVideoUrl, setCreateVideoUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join Room state
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinUsername, setJoinUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUsername.trim()) {
      setCreateError('Please enter your username.');
      return;
    }

    let videoId: string | undefined = undefined;
    if (createVideoUrl.trim()) {
      const extracted = extractYouTubeVideoId(createVideoUrl);
      if (!extracted) {
        setCreateError('Invalid YouTube URL or Video ID. Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        return;
      }
      videoId = extracted;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      const res = await createRoom(createUsername.trim(), videoId);

      // Save complete host user session for room page
      localStorage.setItem(`yt_party_user_${res.room.roomCode}`, JSON.stringify({
        participantId: res.hostParticipant.id,
        username: res.hostParticipant.username,
        role: 'HOST',
      }));

      navigate(`/room/${res.room.roomCode}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create watch party room.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinRoomCode.trim().toUpperCase();
    const cleanName = joinUsername.trim();

    if (!cleanCode) {
      setJoinError('Please enter a room code.');
      return;
    }
    if (!cleanName) {
      setJoinError('Please enter your username.');
      return;
    }

    try {
      setIsJoining(true);
      setJoinError(null);
      // Verify room exists
      await getRoom(cleanCode);

      // Save user session
      localStorage.setItem(`yt_party_user_${cleanCode}`, JSON.stringify({
        username: cleanName,
        role: 'PARTICIPANT',
      }));

      navigate(`/room/${cleanCode}`);
    } catch (err: any) {
      setJoinError(err.message || `Room '${cleanCode}' does not exist or server error.`);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Header />

      <main className="main-content">
        <section className="hero-section">
          <div className="hero-badge">
            <Zap className="hero-badge-icon" />
            <span>Real-time YouTube Synchronization</span>
          </div>
          <h1 className="hero-title">
            Watch YouTube Videos Together <br />
            <span className="hero-title-gradient">In Perfect Sync</span>
          </h1>
          <p className="hero-subtitle">
            Create a private party room, invite friends, and enjoy frame-perfect playback sync with role-based room controls.
          </p>
        </section>

        <section className="interaction-card-section">
          <div className="tab-buttons-container">
            <button
              onClick={() => setActiveTab('create')}
              className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            >
              <PlusCircle className="tab-icon" />
              <span>Create New Room</span>
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`tab-btn ${activeTab === 'join' ? 'active' : ''}`}
            >
              <LogIn className="tab-icon" />
              <span>Join Existing Room</span>
            </button>
          </div>

          <div className="form-card-body">
            {activeTab === 'create' ? (
              <form onSubmit={handleCreateRoom} className="action-form">
                <div className="form-group">
                  <label htmlFor="create-username">Your Username</label>
                  <input
                    id="create-username"
                    type="text"
                    placeholder="Enter your name (e.g. Sajal)"
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value)}
                    maxLength={30}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="create-videourl">YouTube Video URL or ID (Optional)</label>
                  <input
                    id="create-videourl"
                    type="text"
                    placeholder="Optional: Paste YouTube URL (or add later in room)"
                    value={createVideoUrl}
                    onChange={(e) => setCreateVideoUrl(e.target.value)}
                    className="form-input"
                  />
                </div>

                {createError && (
                  <div className="form-error-banner">
                    <AlertCircle className="error-icon" />
                    <span>{createError}</span>
                  </div>
                )}

                <button type="submit" disabled={isCreating} className="submit-action-btn">
                  {isCreating ? 'Creating Room...' : 'Create Watch Party (HOST)'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinRoom} className="action-form">
                <div className="form-group">
                  <label htmlFor="join-roomcode">Room Code</label>
                  <input
                    id="join-roomcode"
                    type="text"
                    placeholder="Enter 6-character room code (e.g. ABC123)"
                    value={joinRoomCode}
                    onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    required
                    className="form-input code-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="join-username">Your Username</label>
                  <input
                    id="join-username"
                    type="text"
                    placeholder="Enter your name (e.g. Rahul)"
                    value={joinUsername}
                    onChange={(e) => setJoinUsername(e.target.value)}
                    maxLength={30}
                    required
                    className="form-input"
                  />
                </div>

                {joinError && (
                  <div className="form-error-banner">
                    <AlertCircle className="error-icon" />
                    <span>{joinError}</span>
                  </div>
                )}

                <button type="submit" disabled={isJoining} className="submit-action-btn join">
                  {isJoining ? 'Connecting...' : 'Join Watch Party'}
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="features-grid-section">
          <div className="feature-card">
            <div className="feature-icon-box">
              <Zap />
            </div>
            <h3>Authoritative Sync</h3>
            <p>Single authoritative server timer keeps video playback synchronized for all room members without drift.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <ShieldCheck />
            </div>
            <h3>Role-Based Access Control</h3>
            <p>Hosts manage moderators and viewers. Strict server-side RBAC authorization prevents unauthorized playback interference.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <Users />
            </div>
            <h3>Real-time Room Management</h3>
            <p>Live participant list updates instantly when users join, leave, change roles, get promoted, or transfer host.</p>
          </div>
        </section>
      </main>
    </div>
  );
};
