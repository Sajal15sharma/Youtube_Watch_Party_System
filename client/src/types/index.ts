export type Role = 'HOST' | 'MODERATOR' | 'PARTICIPANT';

export type PlayState = 'playing' | 'paused';

export interface Room {
  id: string;
  roomCode: string;
  hostUserId: string;
  currentVideoId: string | null;
  currentPlaybackState: PlayState;
  currentPlaybackTime: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Participant {
  id: string;
  roomId: string;
  username: string;
  role: Role;
  socketId?: string | null;
  joinedAt?: string;
}

export interface RoomStatePayload {
  room: {
    id: string;
    roomCode: string;
    hostUserId: string;
    currentVideoId: string | null;
    currentPlaybackState: PlayState;
    currentPlaybackTime: number;
    lastUpdated: number;
    updatedAtServerTime?: number;
  };
  participants: Participant[];
  currentUser: Participant;
}

export interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
}
