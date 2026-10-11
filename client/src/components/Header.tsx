import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RoleBadge } from './RoleBadge';
import { Role } from '../types/index';
import { Copy, Check, LogOut, Video, Users } from 'lucide-react';

interface HeaderProps {
  roomCode?: string;
  role?: Role;
  username?: string;
  onLeave?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ roomCode, role, username, onLeave }) => {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleCopyLink = () => {
    if (!roomCode) return;
    const roomUrl = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    if (onLeave) onLeave();
    navigate('/');
  };

  return (
    <header className="header-bar">
      <div className="header-container">
        <Link to="/" className="brand-logo">
          <div className="brand-icon-wrapper">
            <Video className="brand-icon" />
          </div>
          <span className="brand-title">
            Watch<span className="brand-title-accent">Party</span>
          </span>
        </Link>

        {roomCode && (
          <div className="header-room-info">
            <div className="room-code-chip">
              <Users className="chip-icon" />
              <span className="chip-label">Room:</span>
              <span className="chip-code">{roomCode}</span>
              <button
                onClick={handleCopyLink}
                className="copy-btn"
                title="Copy Room Share Link"
              >
                {copied ? <Check className="btn-icon success" /> : <Copy className="btn-icon" />}
                <span>{copied ? 'Copied!' : 'Share'}</span>
              </button>
            </div>

            {role && username && (
              <div className="user-profile-chip">
                <span className="user-name">{username}</span>
                <RoleBadge role={role} size="sm" />
              </div>
            )}

            <button onClick={handleLeaveRoom} className="leave-btn" title="Leave Party">
              <LogOut className="btn-icon" />
              <span>Leave</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
