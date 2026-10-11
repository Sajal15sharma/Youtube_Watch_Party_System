import { Request, Response, NextFunction } from 'express';
import { roomService } from '../services/roomService.js';
import { participantService } from '../services/participantService.js';
import { z } from 'zod';

import { extractYouTubeVideoId } from '../utils/youtube.js';

export const createRoomSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username must be under 50 characters'),
  videoId: z.string().optional().nullable(),
});

export class RoomController {
  public async createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, videoId } = req.body;
      const initialVideoId = videoId && videoId.trim() ? extractYouTubeVideoId(videoId) : null;

      if (videoId && videoId.trim() && !initialVideoId) {
        res.status(400).json({ error: 'Invalid YouTube video URL or Video ID provided.' });
        return;
      }

      const result = await roomService.createRoom(username, initialVideoId);
      res.status(201).json({
        message: 'Room created successfully',
        room: result.room,
        hostParticipant: result.hostParticipant,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params;
      const room = await roomService.getRoomByCode(roomCode);

      if (!room) {
        res.status(404).json({ error: `Room with code '${roomCode}' not found.` });
        return;
      }

      res.status(200).json({ room });
    } catch (error) {
      next(error);
    }
  }

  public async getParticipants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params;
      const participants = await participantService.getParticipants(roomCode);
      res.status(200).json({ participants });
    } catch (error) {
      next(error);
    }
  }
}

export const roomController = new RoomController();
