import { Role } from '../types/index.js';

export type Action =
  | 'play'
  | 'pause'
  | 'seek'
  | 'change_video'
  | 'assign_role'
  | 'remove_participant'
  | 'transfer_host';

/**
 * Validates whether a participant role has permission to execute a given action.
 * Playback control and room administration belong exclusively to the room HOST.
 */
export function hasPermission(role: Role, action: Action): boolean {
  switch (action) {
    case 'play':
    case 'pause':
    case 'seek':
    case 'change_video':
      return role === 'HOST' || role === 'MODERATOR';

    case 'assign_role':
    case 'remove_participant':
    case 'transfer_host':
      return role === 'HOST';

    default:
      return false;
  }
}

/**
 * Returns user friendly error message if authorization fails.
 */
export function getPermissionErrorMessage(action: Action, role: Role): string {
  if (action === 'assign_role' || action === 'remove_participant' || action === 'transfer_host') {
    return `Unauthorized: Only the room HOST can execute '${action}'. Your current role is '${role}'.`;
  }
  return `Unauthorized: Only HOST or MODERATOR can control video playback. Your current role is '${role}'.`;
}
