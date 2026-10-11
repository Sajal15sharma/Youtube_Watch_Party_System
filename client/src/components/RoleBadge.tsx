import React from 'react';
import { Role } from '../types/index';
import { Crown, Shield, User } from 'lucide-react';

interface RoleBadgeProps {
  role: Role;
  size?: 'sm' | 'md';
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md' }) => {
  switch (role) {
    case 'HOST':
      return (
        <span className={`role-badge role-host ${size}`}>
          <Crown className="badge-icon" />
          <span>HOST</span>
        </span>
      );
    case 'MODERATOR':
      return (
        <span className={`role-badge role-moderator ${size}`}>
          <Shield className="badge-icon" />
          <span>MODERATOR</span>
        </span>
      );
    case 'PARTICIPANT':
    default:
      return (
        <span className={`role-badge role-participant ${size}`}>
          <User className="badge-icon" />
          <span>VIEWER</span>
        </span>
      );
  }
};
