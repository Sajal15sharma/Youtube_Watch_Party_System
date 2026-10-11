import React, { useState } from 'react';
import { Participant, Role } from '../types/index';
import { RoleBadge } from './RoleBadge';
import { Users, Shield, ShieldOff, UserX, Crown, MoreVertical } from 'lucide-react';

interface ParticipantListProps {
  participants: Participant[];
  currentUser: Participant | null;
  onAssignRole: (targetUserId: string, role: Role) => void;
  onRemoveParticipant: (targetUserId: string) => void;
  onTransferHost: (newHostUserId: string) => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUser,
  onAssignRole,
  onRemoveParticipant,
  onTransferHost,
}) => {
  const isHost = currentUser?.role === 'HOST';
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  const toggleMenu = (userId: string) => {
    setActiveMenuUserId((prev) => (prev === userId ? null : userId));
  };

  return (
    <div className="participant-list-card">
      <div className="card-header">
        <div className="card-title">
          <Users className="card-icon" />
          <h3>Participants</h3>
        </div>
        <span className="count-badge">{participants.length}</span>
      </div>

      <div className="participant-items-wrapper">
        {participants.length === 0 ? (
          <div className="empty-participants">No participants connected</div>
        ) : (
          participants.map((p) => {
            const isSelf = currentUser?.id === p.id;
            const isMenuOpen = activeMenuUserId === p.id;

            return (
              <div key={p.id} className={`participant-item ${isSelf ? 'is-self' : ''}`}>
                <div className="participant-info">
                  <span className="participant-name">
                    {p.username}
                    {isSelf && <span className="you-tag">(You)</span>}
                  </span>
                  <RoleBadge role={p.role} size="sm" />
                </div>

                {isHost && !isSelf && (
                  <div className="host-actions-container">
                    <button
                      onClick={() => toggleMenu(p.id)}
                      className="menu-toggle-btn"
                      title="Manage Participant"
                    >
                      <MoreVertical className="btn-icon" />
                    </button>

                    {isMenuOpen && (
                      <div className="actions-dropdown-menu">
                        {p.role === 'PARTICIPANT' ? (
                          <button
                            onClick={() => {
                              onAssignRole(p.id, 'MODERATOR');
                              setActiveMenuUserId(null);
                            }}
                            className="dropdown-item promote"
                          >
                            <Shield className="item-icon" />
                            <span>Make Moderator</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              onAssignRole(p.id, 'PARTICIPANT');
                              setActiveMenuUserId(null);
                            }}
                            className="dropdown-item demote"
                          >
                            <ShieldOff className="item-icon" />
                            <span>Demote to Viewer</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (window.confirm(`Transfer HOST privileges to ${p.username}?`)) {
                              onTransferHost(p.id);
                              setActiveMenuUserId(null);
                            }
                          }}
                          className="dropdown-item transfer"
                        >
                          <Crown className="item-icon" />
                          <span>Transfer Host</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${p.username} from this watch party?`)) {
                              onRemoveParticipant(p.id);
                              setActiveMenuUserId(null);
                            }
                          }}
                          className="dropdown-item remove"
                        >
                          <UserX className="item-icon" />
                          <span>Remove Participant</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
