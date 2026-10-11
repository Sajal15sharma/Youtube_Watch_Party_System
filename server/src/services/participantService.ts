import { db, checkDbConnection } from '../db/index.js';
import { participants, rooms } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { roomStateStore } from './roomStateStore.js';
import { roomService } from './roomService.js';
import { Participant, Role } from '../types/index.js';
import { cryptoRandomUUID } from '../utils/crypto.js';
import { normalizeRoomCode } from '../utils/roomCodeGenerator.js';

export class ParticipantService {
  /**
   * Registers a participant joining a room.
   * Ensures room creators are strictly assigned HOST role and prevents duplicate participant records.
   */
  public async joinRoom(
    roomCodeInput: string,
    usernameInput: string,
    existingParticipantId?: string,
    socketId?: string
  ): Promise<{ participant: Participant; participants: Participant[] }> {
    const roomCode = normalizeRoomCode(roomCodeInput);
    const username = usernameInput.trim();

    if (!username) {
      throw new Error('Username is required to join a room.');
    }

    const room = await roomService.getRoomByCode(roomCode);
    if (!room) {
      throw new Error(`Room with code '${roomCode}' not found.`);
    }

    // 1. Check if participant exists in roomStateStore by existingParticipantId
    if (existingParticipantId) {
      const existingPart = roomStateStore.getParticipant(roomCode, existingParticipantId);
      if (existingPart) {
        existingPart.socketId = socketId || null;
        if (socketId) {
          roomStateStore.mapSocket(socketId, roomCode, existingPart.id);
        }
        // Force HOST role if participant matches room.hostUserId, otherwise ensure non-host role
        if (room.hostUserId === existingPart.id) {
          existingPart.role = 'HOST';
        } else if (existingPart.role === 'HOST') {
          existingPart.role = 'MODERATOR';
        }
        return {
          participant: existingPart,
          participants: roomStateStore.getParticipants(roomCode),
        };
      }
    }

    // 2. Check if a participant with this username already exists in roomStateStore
    const activeParticipants = roomStateStore.getParticipants(roomCode);
    const existingByUsername = activeParticipants.find(
      (p) => p.username.toLowerCase() === username.toLowerCase()
    );

    if (existingByUsername) {
      existingByUsername.socketId = socketId || null;
      if (socketId) {
        roomStateStore.mapSocket(socketId, roomCode, existingByUsername.id);
      }
      // Force HOST role if participant matches room.hostUserId, otherwise ensure non-host role
      if (room.hostUserId === existingByUsername.id) {
        existingByUsername.role = 'HOST';
      } else if (existingByUsername.role === 'HOST') {
        existingByUsername.role = 'MODERATOR';
      }
      return {
        participant: existingByUsername,
        participants: activeParticipants,
      };
    }

    // 3. Determine if joining user is the Room Host
    const isHost = room.hostUserId === existingParticipantId || activeParticipants.length === 0;

    const role: Role = isHost ? 'HOST' : 'PARTICIPANT';
    const newParticipantId = (isHost ? room.hostUserId : existingParticipantId) || cryptoRandomUUID();
    const now = new Date();

    const participant: Participant = {
      id: newParticipantId,
      roomId: room.id,
      username,
      role,
      socketId: socketId || null,
      joinedAt: now,
    };

    // Store in active real-time state
    roomStateStore.addParticipant(roomCode, participant);
    if (socketId) {
      roomStateStore.mapSocket(socketId, roomCode, participant.id);
    }

    // Persist in DB if reachable
    const isDbAlive = await checkDbConnection();
    if (isDbAlive) {
      try {
        await db.insert(participants).values({
          id: participant.id,
          roomId: participant.roomId,
          username: participant.username,
          role: participant.role,
          socketId: participant.socketId,
          joinedAt: participant.joinedAt,
        });
      } catch (err) {
        console.warn('DB participant insert notice:', (err as any)?.message || err);
      }
    }

    return {
      participant,
      participants: roomStateStore.getParticipants(roomCode),
    };
  }

  /**
   * Retrieves all participants in a room.
   */
  public async getParticipants(roomCodeInput: string): Promise<Participant[]> {
    const roomCode = normalizeRoomCode(roomCodeInput);
    const inMemoryParts = roomStateStore.getParticipants(roomCode);
    if (inMemoryParts.length > 0) {
      return inMemoryParts;
    }

    const room = await roomService.getRoomByCode(roomCode);
    if (!room) return [];

    const isDbAlive = await checkDbConnection();
    if (isDbAlive) {
      try {
        const dbParts = await db.select().from(participants).where(eq(participants.roomId, room.id));
        return dbParts.map((p) => ({
          id: p.id,
          roomId: p.roomId,
          username: p.username,
          role: p.role as Role,
          socketId: p.socketId,
          joinedAt: p.joinedAt,
        }));
      } catch (err) {
        console.error('Error loading participants from DB:', err);
      }
    }

    return [];
  }

  /**
   * Updates a participant's role (e.g. HOST promotes to MODERATOR).
   */
  public async updateRole(roomCodeInput: string, targetUserId: string, newRole: Role): Promise<Participant | null> {
    const roomCode = normalizeRoomCode(roomCodeInput);
    const updated = roomStateStore.updateParticipantRole(roomCode, targetUserId, newRole);
    if (!updated) return null;

    const isDbAlive = await checkDbConnection();
    if (isDbAlive) {
      try {
        await db.update(participants).set({ role: newRole }).where(eq(participants.id, targetUserId));
      } catch (err) {
        console.error('Error updating participant role in DB:', err);
      }
    }

    return updated;
  }

  /**
   * Removes a participant from room (Host kicks user or user leaves).
   */
  public async removeParticipant(roomCodeInput: string, targetUserId: string): Promise<Participant | null> {
    const roomCode = normalizeRoomCode(roomCodeInput);
    const removed = roomStateStore.removeParticipant(roomCode, targetUserId);

    const isDbAlive = await checkDbConnection();
    if (isDbAlive) {
      try {
        await db.delete(participants).where(eq(participants.id, targetUserId));
      } catch (err) {
        console.error('Error removing participant from DB:', err);
      }
    }

    return removed || null;
  }

  /**
   * Transfers room HOST privileges from oldHostId to newHostId.
   */
  public async transferHost(roomCodeInput: string, oldHostId: string, newHostId: string): Promise<boolean> {
    const roomCode = normalizeRoomCode(roomCodeInput);
    const success = roomStateStore.transferHost(roomCode, oldHostId, newHostId);
    if (!success) return false;

    const isDbAlive = await checkDbConnection();
    if (isDbAlive) {
      try {
        const room = await roomService.getRoomByCode(roomCode);
        if (room) {
          await db.update(rooms).set({ hostUserId: newHostId }).where(eq(rooms.id, room.id));
          await db.update(participants).set({ role: 'MODERATOR' }).where(eq(participants.id, oldHostId));
          await db.update(participants).set({ role: 'HOST' }).where(eq(participants.id, newHostId));
        }
      } catch (err) {
        console.error('Error persisting host transfer to DB:', err);
      }
    }

    return true;
  }
}

export const participantService = new ParticipantService();
