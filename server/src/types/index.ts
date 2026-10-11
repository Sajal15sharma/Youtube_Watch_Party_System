export type Role = 'HOST' | 'MODERATOR' | 'PARTICIPANT';

export type PlayState = 'playing' | 'paused';

export interface Room {
  id: string;
  roomCode: string;
  hostUserId: string;
  currentVideoId: string | null;
  currentPlaybackState: PlayState;
  currentPlaybackTime: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  id: string;
  roomId: string;
  username: string;
  role: Role;
  socketId?: string | null;
  joinedAt: Date;
}

export interface RealtimeRoomState {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  currentVideoId: string | null;
  currentPlaybackState: PlayState;
  currentPlaybackTime: number;
  lastUpdated: number; // timestamp in ms when state/time was last set
}

export interface ClientToServerEvents {
  join_room: (data: { roomCode: string; username: string; participantId?: string }) => void;
  leave_room: (data: { roomCode: string }) => void;
  play: (data: { roomCode: string; time?: number }) => void;
  pause: (data: { roomCode: string; time?: number }) => void;
  seek: (data: { roomCode: string; time: number }) => void;
  change_video: (data: { roomCode: string; videoId: string }) => void;
  assign_role: (data: { roomCode: string; targetUserId: string; role: Role }) => void;
  remove_participant: (data: { roomCode: string; targetUserId: string }) => void;
  transfer_host: (data: { roomCode: string; newHostUserId: string }) => void;
  send_chat_message: (data: { roomCode: string; message: string }) => void;
  sync_ping: (data: { clientTime: number }) => void;
  sync_heartbeat: (data: { roomCode: string; time: number; isPlaying: boolean }) => void;
}

export interface ServerToClientEvents {
  room_state: (data: {
    room: {
      id: string;
      roomCode: string;
      hostUserId: string;
      currentVideoId: string | null;
      currentPlaybackState: PlayState;
      currentPlaybackTime: number;
      lastUpdated: number;
    };
    participants: Participant[];
    currentUser: Participant;
  }) => void;
  user_joined: (data: { participant: Participant }) => void;
  user_left: (data: { participantId: string; username: string }) => void;
  play: (data: { time: number; videoId: string | null; updatedBy: string; updatedAtServerTime?: number }) => void;
  pause: (data: { time: number; videoId: string | null; updatedBy: string; updatedAtServerTime?: number }) => void;
  seek: (data: { time: number; updatedBy: string; updatedAtServerTime?: number }) => void;
  video_changed: (data: { videoId: string; time: number; updatedBy: string; updatedAtServerTime?: number }) => void;
  role_assigned: (data: { targetUserId: string; newRole: Role; updatedBy: string }) => void;
  participant_removed: (data: { targetUserId: string; removedBy: string }) => void;
  host_transferred: (data: { oldHostId: string; newHostId: string; updatedBy: string }) => void;
  chat_message: (data: { id: string; sender: string; message: string; timestamp: string }) => void;
  error: (data: { message: string; code?: string }) => void;
  sync_pong: (data: { clientTime: number; serverTime: number }) => void;
  sync_heartbeat: (data: { time: number; isPlaying: boolean; updatedAtServerTime: number }) => void;
}
