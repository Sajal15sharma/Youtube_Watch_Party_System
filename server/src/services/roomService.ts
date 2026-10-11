import { db, checkDbConnection } from '../db/index.js';
import { rooms, participants } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateRoomCode, normalizeRoomCode } from '../utils/roomCodeGenerator.js';
import { roomStateStore } from './roomStateStore.js';
import { Participant, PlayState, Room } from '../types/index.js';
import { cryptoRandomUUID } from '../utils/crypto.js';

export class RoomService {
  /**
   * Creates a new YouTube watch party room.
   * Generates a unique room code, sets creator as HOST, persists to PostgreSQL / Drizzle, and initializes real-time state.
   */
  public async createRoom(
    hostUsername: string,
    initialVideoId?: string | null
  ): Promise<{ room: Room; hostParticipant: Participant }> {
    const cleanUsername = hostUsername.trim();
    if (!cleanUsername) {
      throw new Error('Username is required to create a room.');
    }

    const roomCode = generateRoomCode(6);
    const roomId = cryptoRandomUUID();
    const hostParticipantId = cryptoRandomUUID();

    const now = new Date();

    const newRoom: Room = {
      id: roomId,
      roomCode,
      hostUserId: hostParticipantId,
      currentVideoId: initialVideoId ?? null,
      currentPlaybackState: 'paused',
      currentPlaybackTime: 0,
      createdAt: now,
      updatedAt: now,
    };

    const hostParticipant: Participant = {
      id: hostParticipantId,
      roomId,
      username: cleanUsername,
      role: 'HOST',
      socketId: null,
      joinedAt: now,
    };

    // Attempt PostgreSQL persistence via Drizzle ORM
    const isDbAlive = await checkDbConnection();
    if (isDbAlive) {
      try {
        await db.insert(rooms).values({
          id: newRoom.id,
          roomCode: newRoom.roomCode,
          hostUserId: newRoom.hostUserId,
          currentVideoId: newRoom.currentVideoId,
          currentPlaybackState: newRoom.currentPlaybackState,
          currentPlaybackTime: newRoom.currentPlaybackTime,
          createdAt: newRoom.createdAt,
          updatedAt: newRoom.updatedAt,
        });

        await db.insert(participants).values({
          id: hostParticipant.id,
          roomId: hostParticipant.roomId,
          username: hostParticipant.username,
          role: hostParticipant.role,
          joinedAt: hostParticipant.joinedAt,
        });
      } catch (err) {
        console.error('PostgreSQL error while creating room:', err);
      }
    }

    // Initialize active in-memory real-time state
    roomStateStore.initRoomState(
      newRoom.id,
      newRoom.roomCode,
      newRoom.hostUserId,
      newRoom.currentVideoId,
      newRoom.currentPlaybackState,
      newRoom.currentPlaybackTime
    );

    roomStateStore.addParticipant(newRoom.roomCode, hostParticipant);

    return { room: newRoom, hostParticipant };
  }

  /**
   * Fetches room details by room code.
   */
  public async getRoomByCode(code: string): Promise<Room | null> {
    const roomCode = normalizeRoomCode(code);
    
    // Check in-memory store first
    const activeState = roomStateStore.getRoomState(roomCode);
    if (activeState) {
      return {
        id: activeState.roomId,
        roomCode: activeState.roomCode,
        hostUserId: activeState.hostUserId,
        currentVideoId: activeState.currentVideoId,
        currentPlaybackState: activeState.currentPlaybackState,
        currentPlaybackTime: activeState.currentPlaybackTime,
        createdAt: new Date(),
        updatedAt: new Date(activeState.lastUpdated),
      };
    }

    // Check DB
    const isDbAlive = await checkDbConnection();
    if (isDbAlive) {
      try {
        const result = await db.select().from(rooms).where(eq(rooms.roomCode, roomCode)).limit(1);
        if (result.length > 0) {
          const r = result[0];
          const roomObj: Room = {
            id: r.id,
            roomCode: r.roomCode,
            hostUserId: r.hostUserId,
            currentVideoId: r.currentVideoId,
            currentPlaybackState: r.currentPlaybackState as PlayState,
            currentPlaybackTime: r.currentPlaybackTime,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };
          // Restore into memory
          roomStateStore.initRoomState(
            roomObj.id,
            roomObj.roomCode,
            roomObj.hostUserId,
            roomObj.currentVideoId,
            roomObj.currentPlaybackState,
            roomObj.currentPlaybackTime
          );
          return roomObj;
        }
      } catch (err) {
        console.error('Error fetching room from database:', err);
      }
    }

    return null;
  }

  /**
   * Updates playback state for room
   */
  public async updatePlayback(
    roomCode: string,
    updates: { videoId?: string | null; playState?: PlayState; currentTime?: number }
  ) {
    const normalizedCode = normalizeRoomCode(roomCode);
    const updatedState = roomStateStore.updatePlaybackState(normalizedCode, updates);
    if (!updatedState) return null;

    // Async DB update if connected
    const isDbAlive = await checkDbConnection();
    if (isDbAlive) {
      try {
        await db
          .update(rooms)
          .set({
            currentVideoId: updatedState.currentVideoId,
            currentPlaybackState: updatedState.currentPlaybackState,
            currentPlaybackTime: updatedState.currentPlaybackTime,
            updatedAt: new Date(),
          })
          .where(eq(rooms.roomCode, normalizedCode));
      } catch (err) {
        console.error('Error syncing room playback to PostgreSQL:', err);
      }
    }

    return updatedState;
  }
}

export const roomService = new RoomService();
