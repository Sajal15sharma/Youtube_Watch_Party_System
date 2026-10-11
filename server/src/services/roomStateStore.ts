import { Participant, PlayState, RealtimeRoomState, Role } from '../types/index.js';

class RoomStateStore {
  // roomCode -> active real-time playback state
  private roomStates: Map<string, RealtimeRoomState> = new Map();

  // roomCode -> Map<participantId, Participant>
  private participants: Map<string, Map<string, Participant>> = new Map();

  // socketId -> { roomCode, participantId }
  private socketMap: Map<string, { roomCode: string; participantId: string }> = new Map();

  /**
   * Initializes or loads active room playback state in memory.
   */
  public initRoomState(
    id: string,
    roomCode: string,
    hostUserId: string,
    currentVideoId: string | null,
    currentPlaybackState: PlayState = 'paused',
    currentPlaybackTime: number = 0
  ): RealtimeRoomState {
    const existing = this.roomStates.get(roomCode);
    if (existing) {
      return existing;
    }

    const state: RealtimeRoomState = {
      roomId: id,
      roomCode,
      hostUserId,
      currentVideoId,
      currentPlaybackState,
      currentPlaybackTime,
      lastUpdated: Date.now(),
    };

    this.roomStates.set(roomCode, state);
    if (!this.participants.has(roomCode)) {
      this.participants.set(roomCode, new Map());
    }
    return state;
  }

  /**
   * Retrieves current room state, computing live elapsed play time if playing.
   */
  public getRoomState(roomCode: string): RealtimeRoomState | undefined {
    const state = this.roomStates.get(roomCode);
    if (!state) return undefined;

    // Calculate current drift if video is playing
    if (state.currentPlaybackState === 'playing') {
      const now = Date.now();
      const elapsedSeconds = (now - state.lastUpdated) / 1000;
      return {
        ...state,
        currentPlaybackTime: state.currentPlaybackTime + elapsedSeconds,
      };
    }

    return state;
  }

  /**
   * Updates room playback state (play, pause, seek, change_video).
   */
  public updatePlaybackState(
    roomCode: string,
    updates: {
      videoId?: string | null;
      playState?: PlayState;
      currentTime?: number;
    }
  ): RealtimeRoomState | undefined {
    const currentState = this.getRoomState(roomCode);
    if (!currentState) return undefined;

    const newState: RealtimeRoomState = {
      ...currentState,
      currentVideoId: updates.videoId ?? currentState.currentVideoId,
      currentPlaybackState: updates.playState ?? currentState.currentPlaybackState,
      currentPlaybackTime: typeof updates.currentTime === 'number' ? updates.currentTime : currentState.currentPlaybackTime,
      lastUpdated: Date.now(),
    };

    this.roomStates.set(roomCode, newState);
    return newState;
  }

  /**
   * Helper to find the best candidate to inherit Host role if Host leaves or disconnects.
   * Priority: active MODERATOR -> active PARTICIPANT with active socket -> any remaining participant.
   */
  public findNextHostCandidate(roomCode: string, excludeId?: string): Participant | undefined {
    const all = this.getParticipants(roomCode).filter((p) => p.id !== excludeId);
    if (all.length === 0) return undefined;

    // First try connected moderator
    const connectedMod = all.find((p) => p.role === 'MODERATOR' && p.socketId);
    if (connectedMod) return connectedMod;

    // Any moderator
    const anyMod = all.find((p) => p.role === 'MODERATOR');
    if (anyMod) return anyMod;

    // Connected participant
    const connectedPart = all.find((p) => p.socketId);
    if (connectedPart) return connectedPart;

    return all[0];
  }

  /**
   * Participant list management in memory
   */
  public addParticipant(roomCode: string, participant: Participant): void {
    if (!this.participants.has(roomCode)) {
      this.participants.set(roomCode, new Map());
    }
    this.participants.get(roomCode)!.set(participant.id, participant);
  }

  public removeParticipant(roomCode: string, participantId: string): Participant | undefined {
    const roomParts = this.participants.get(roomCode);
    if (!roomParts) return undefined;
    const part = roomParts.get(participantId);
    if (part) {
      roomParts.delete(participantId);
    }
    return part;
  }

  public getParticipants(roomCode: string): Participant[] {
    const roomParts = this.participants.get(roomCode);
    if (!roomParts) return [];
    return Array.from(roomParts.values());
  }

  public getParticipant(roomCode: string, participantId: string): Participant | undefined {
    return this.participants.get(roomCode)?.get(participantId);
  }

  public updateParticipantRole(roomCode: string, participantId: string, role: Role): Participant | undefined {
    const participant = this.getParticipant(roomCode, participantId);
    if (!participant) return undefined;
    participant.role = role;
    return participant;
  }

  public transferHost(roomCode: string, oldHostId: string, newHostId: string): boolean {
    const oldHost = this.getParticipant(roomCode, oldHostId);
    const newHost = this.getParticipant(roomCode, newHostId);
    if (!oldHost || !newHost) return false;

    oldHost.role = 'MODERATOR';
    newHost.role = 'HOST';

    const roomState = this.roomStates.get(roomCode);
    if (roomState) {
      roomState.hostUserId = newHostId;
    }
    return true;
  }

  /**
   * Socket to participant mapping
   */
  public mapSocket(socketId: string, roomCode: string, participantId: string): void {
    this.socketMap.set(socketId, { roomCode, participantId });
    const part = this.getParticipant(roomCode, participantId);
    if (part) {
      part.socketId = socketId;
    }
  }

  public getSocketMapping(socketId: string): { roomCode: string; participantId: string } | undefined {
    return this.socketMap.get(socketId);
  }

  public unmapSocket(socketId: string): { roomCode: string; participantId: string } | undefined {
    const mapping = this.socketMap.get(socketId);
    if (mapping) {
      this.socketMap.delete(socketId);
      const part = this.getParticipant(mapping.roomCode, mapping.participantId);
      if (part && part.socketId === socketId) {
        part.socketId = null;
      }
    }
    return mapping;
  }
}

export const roomStateStore = new RoomStateStore();
