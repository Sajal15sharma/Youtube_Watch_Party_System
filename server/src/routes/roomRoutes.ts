import { Router } from 'express';
import { roomController, createRoomSchema } from '../controllers/roomController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// POST /api/rooms - Create a new room
router.post('/rooms', validateRequest(createRoomSchema), (req, res, next) =>
  roomController.createRoom(req, res, next)
);

// GET /api/rooms/:roomCode - Fetch room info
router.get('/rooms/:roomCode', (req, res, next) =>
  roomController.getRoom(req, res, next)
);

// GET /api/rooms/:roomCode/participants - Fetch room participants
router.get('/rooms/:roomCode/participants', (req, res, next) =>
  roomController.getParticipants(req, res, next)
);

export default router;
