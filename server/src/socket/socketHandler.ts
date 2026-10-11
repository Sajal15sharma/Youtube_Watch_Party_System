import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';
import { roomStateStore } from '../services/roomStateStore.js';
import { roomService } from '../services/roomService.js';
import { participantService } from '../services/participantService.js';
import { hasPermission, getPermissionErrorMessage } from '../utils/rbac.js';
import { normalizeRoomCode } from '../utils/roomCodeGenerator.js';

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>
): void {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    /**
     * Helper to retrieve active participant for socket
     */
    const getSocketContext = () => {
      const mapping = roomStateStore.getSocketMapping(socket.id);
      if (!mapping) return null;
      const participant = roomStateStore.getParticipant(mapping.roomCode, mapping.participantId);
      return { roomCode: mapping.roomCode, participant };
    };

    /**
     * Event: join_room
     */
    socket.on('join_room', async ({ roomCode: rawCode, username, participantId }) => {
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const room = await roomService.getRoomByCode(roomCode);

        if (!room) {
          socket.emit('error', { message: `Room with code '${roomCode}' does not exist.` });
          return;
        }

        const { participant, participants } = await participantService.joinRoom(
          roomCode,
          username,
          participantId,
          socket.id
        );

        const socketRoomKey = `room:${roomCode}`;
        socket.join(socketRoomKey);

        const activeState = roomStateStore.getRoomState(roomCode);
        if (!activeState) {
          socket.emit('error', { message: 'Failed to retrieve active room state.' });
          return;
        }

        // Emit current authoritative state to newly joined client
        socket.emit('room_state', {
          room: {
            id: activeState.roomId,
            roomCode: activeState.roomCode,
            hostUserId: activeState.hostUserId,
            currentVideoId: activeState.currentVideoId,
            currentPlaybackState: activeState.currentPlaybackState,
            currentPlaybackTime: activeState.currentPlaybackTime,
            lastUpdated: activeState.lastUpdated,
          },
          participants,
          currentUser: participant,
        });

        // Broadcast user_joined to other participants
        socket.to(socketRoomKey).emit('user_joined', { participant });
        console.log(`[Join Room] ${username} (${participant.role}) joined room '${roomCode}'`);
      } catch (err: any) {
        console.error('[Socket Error join_room]', err.message);
        socket.emit('error', { message: err.message || 'Failed to join room.' });
      }
    });

    /**
     * Event: leave_room
     */
    socket.on('leave_room', async ({ roomCode: rawCode }) => {
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const ctx = getSocketContext();
        if (ctx && ctx.participant) {
          const isLeavingHost = ctx.participant.role === 'HOST';
          await participantService.removeParticipant(roomCode, ctx.participant.id);
          socket.leave(`room:${roomCode}`);
          socket.to(`room:${roomCode}`).emit('user_left', {
            participantId: ctx.participant.id,
            username: ctx.participant.username,
          });

          if (isLeavingHost) {
            const nextHost = roomStateStore.findNextHostCandidate(roomCode, ctx.participant.id);
            if (nextHost) {
              await participantService.transferHost(roomCode, ctx.participant.id, nextHost.id);
              console.log(`[SYNC] Host left -> transferred to '${nextHost.username}' (${nextHost.id})`);
              io.to(`room:${roomCode}`).emit('host_transferred', {
                oldHostId: ctx.participant.id,
                newHostId: nextHost.id,
                updatedBy: 'System',
              });
            }
          }
        }
        roomStateStore.unmapSocket(socket.id);
      } catch (err: any) {
        console.error('[Socket Error leave_room]', err.message);
      }
    });

    /**
     * Event: sync_ping
     */
    socket.on('sync_ping', ({ clientTime }) => {
      socket.emit('sync_pong', {
        clientTime,
        serverTime: Date.now(),
      });
    });

    /**
     * Event: sync_heartbeat
     */
    socket.on('sync_heartbeat', async ({ roomCode: rawCode, time, isPlaying }) => {
      const roomCode = normalizeRoomCode(rawCode);
      const ctx = getSocketContext();
      if (!ctx || !ctx.participant) return;
      if (!hasPermission(ctx.participant.role, 'play')) {
        console.log(`[SYNC] Server rejected heartbeat from non-controller '${ctx.participant.username}' (${ctx.participant.role})`);
        return;
      }

      const serverNow = Date.now();
      roomStateStore.updatePlaybackState(roomCode, {
        currentTime: time,
        playState: isPlaying ? 'playing' : 'paused',
      });

      socket.to(`room:${roomCode}`).emit('sync_heartbeat', {
        time,
        isPlaying,
        updatedAtServerTime: serverNow,
      });
    });

    /**
     * Event: play
     */
    socket.on('play', async ({ roomCode: rawCode, time }) => {
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const ctx = getSocketContext();
        if (!ctx || !ctx.participant) {
          console.log(`[SYNC] Server received 'play' but no active participant session found for socket: ${socket.id}`);
          socket.emit('error', { message: 'You are not in an active room session.' });
          return;
        }

        console.log(`[SYNC] Server received 'play' from '${ctx.participant.username}' (${ctx.participant.role}) in '${roomCode}', time=${time}`);

        if (!hasPermission(ctx.participant.role, 'play')) {
          console.log(`[SYNC] Server permission decision: REJECTED 'play' for role '${ctx.participant.role}'`);
          socket.emit('error', {
            message: getPermissionErrorMessage('play', ctx.participant.role),
          });
          return;
        }

        console.log(`[SYNC] Server permission decision: PERMITTED 'play' for role '${ctx.participant.role}'`);
        const currentTime = typeof time === 'number' ? time : (roomStateStore.getRoomState(roomCode)?.currentPlaybackTime ?? 0);
        const serverNow = Date.now();

        const updatedState = await roomService.updatePlayback(roomCode, {
          playState: 'playing',
          currentTime,
        });

        if (updatedState) {
          console.log(`[SYNC] Server broadcast 'play' to room:${roomCode}: time=${updatedState.currentPlaybackTime}, videoId=${updatedState.currentVideoId}, serverTime=${serverNow}`);
          io.to(`room:${roomCode}`).emit('play', {
            time: updatedState.currentPlaybackTime,
            videoId: updatedState.currentVideoId,
            updatedBy: ctx.participant.username,
            updatedAtServerTime: serverNow,
          });
        }
      } catch (err: any) {
        console.error(`[SYNC] Server error processing 'play':`, err.message);
        socket.emit('error', { message: err.message || 'Failed to play video.' });
      }
    });

    /**
     * Event: pause
     */
    socket.on('pause', async ({ roomCode: rawCode, time }) => {
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const ctx = getSocketContext();
        if (!ctx || !ctx.participant) {
          console.log(`[SYNC] Server received 'pause' but no active participant session found for socket: ${socket.id}`);
          socket.emit('error', { message: 'You are not in an active room session.' });
          return;
        }

        console.log(`[SYNC] Server received 'pause' from '${ctx.participant.username}' (${ctx.participant.role}) in '${roomCode}', time=${time}`);

        if (!hasPermission(ctx.participant.role, 'pause')) {
          console.log(`[SYNC] Server permission decision: REJECTED 'pause' for role '${ctx.participant.role}'`);
          socket.emit('error', {
            message: getPermissionErrorMessage('pause', ctx.participant.role),
          });
          return;
        }

        console.log(`[SYNC] Server permission decision: PERMITTED 'pause' for role '${ctx.participant.role}'`);
        const currentTime = typeof time === 'number' ? time : (roomStateStore.getRoomState(roomCode)?.currentPlaybackTime ?? 0);
        const serverNow = Date.now();

        const updatedState = await roomService.updatePlayback(roomCode, {
          playState: 'paused',
          currentTime,
        });

        if (updatedState) {
          console.log(`[SYNC] Server broadcast 'pause' to room:${roomCode}: time=${updatedState.currentPlaybackTime}, videoId=${updatedState.currentVideoId}, serverTime=${serverNow}`);
          io.to(`room:${roomCode}`).emit('pause', {
            time: updatedState.currentPlaybackTime,
            videoId: updatedState.currentVideoId,
            updatedBy: ctx.participant.username,
            updatedAtServerTime: serverNow,
          });
        }
      } catch (err: any) {
        console.error(`[SYNC] Server error processing 'pause':`, err.message);
        socket.emit('error', { message: err.message || 'Failed to pause video.' });
      }
    });

    /**
     * Event: seek
     */
    socket.on('seek', async ({ roomCode: rawCode, time }) => {
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const ctx = getSocketContext();
        if (!ctx || !ctx.participant) {
          console.log(`[SYNC] Server received 'seek' but no active participant session found for socket: ${socket.id}`);
          socket.emit('error', { message: 'You are not in an active room session.' });
          return;
        }

        console.log(`[SYNC] Server received 'seek' from '${ctx.participant.username}' (${ctx.participant.role}) in '${roomCode}', targetTime=${time}`);

        if (!hasPermission(ctx.participant.role, 'seek')) {
          console.log(`[SYNC] Server permission decision: REJECTED 'seek' for role '${ctx.participant.role}'`);
          socket.emit('error', {
            message: getPermissionErrorMessage('seek', ctx.participant.role),
          });
          return;
        }

        console.log(`[SYNC] Server permission decision: PERMITTED 'seek' for role '${ctx.participant.role}'`);
        const serverNow = Date.now();
        const updatedState = await roomService.updatePlayback(roomCode, {
          currentTime: time,
        });

        if (updatedState) {
          console.log(`[SYNC] Server broadcast 'seek' to room:${roomCode}: time=${time}, serverTime=${serverNow}`);
          io.to(`room:${roomCode}`).emit('seek', {
            time,
            updatedBy: ctx.participant.username,
            updatedAtServerTime: serverNow,
          });
        }
      } catch (err: any) {
        console.error(`[SYNC] Server error processing 'seek':`, err.message);
        socket.emit('error', { message: err.message || 'Failed to seek.' });
      }
    });

    /**
     * Event: change_video
     */
    socket.on('change_video', async ({ roomCode: rawCode, videoId }) => {
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const ctx = getSocketContext();
        if (!ctx || !ctx.participant) {
          console.log(`[SYNC] Server received 'change_video' but no active participant session found for socket: ${socket.id}`);
          socket.emit('error', { message: 'You are not in an active room session.' });
          return;
        }

        console.log(`[SYNC] Server received 'change_video' from '${ctx.participant.username}' (${ctx.participant.role}) in '${roomCode}', videoId=${videoId}`);

        if (!hasPermission(ctx.participant.role, 'change_video')) {
          console.log(`[SYNC] Server permission decision: REJECTED 'change_video' for role '${ctx.participant.role}'`);
          socket.emit('error', {
            message: getPermissionErrorMessage('change_video', ctx.participant.role),
          });
          return;
        }

        console.log(`[SYNC] Server permission decision: PERMITTED 'change_video' for role '${ctx.participant.role}'`);
        const cleanVideoId = videoId.trim();
        if (!cleanVideoId) {
          socket.emit('error', { message: 'Invalid YouTube video ID.' });
          return;
        }

        const serverNow = Date.now();
        const updatedState = await roomService.updatePlayback(roomCode, {
          videoId: cleanVideoId,
          currentTime: 0,
          playState: 'paused',
        });

        if (updatedState) {
          console.log(`[SYNC] Server broadcast 'video_changed' to room:${roomCode}: videoId=${cleanVideoId}, time=0, serverTime=${serverNow}`);
          io.to(`room:${roomCode}`).emit('video_changed', {
            videoId: cleanVideoId,
            time: 0,
            updatedBy: ctx.participant.username,
            updatedAtServerTime: serverNow,
          });
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message || 'Failed to change video.' });
      }
    });

    /**
     * Event: assign_role
     */
    socket.on('assign_role', async ({ roomCode: rawCode, targetUserId, role }) => {
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const ctx = getSocketContext();
        if (!ctx || !ctx.participant) {
          socket.emit('error', { message: 'You are not in an active room session.' });
          return;
        }

        if (!hasPermission(ctx.participant.role, 'assign_role')) {
          socket.emit('error', {
            message: getPermissionErrorMessage('assign_role', ctx.participant.role),
          });
          return;
        }

        if (targetUserId === ctx.participant.id) {
          socket.emit('error', { message: 'Host cannot modify their own role via assign_role.' });
          return;
        }

        const targetPart = roomStateStore.getParticipant(roomCode, targetUserId);
        if (!targetPart) {
          socket.emit('error', { message: 'Target participant not found in this room.' });
          return;
        }

        if (role === 'HOST') {
          socket.emit('error', { message: 'Cannot assign HOST role via assign_role. Use transfer_host instead.' });
          return;
        }

        if (role !== 'MODERATOR' && role !== 'PARTICIPANT') {
          socket.emit('error', { message: 'Invalid target role specified.' });
          return;
        }

        const updatedPart = await participantService.updateRole(roomCode, targetUserId, role);
        if (updatedPart) {
          io.to(`room:${roomCode}`).emit('role_assigned', {
            targetUserId,
            newRole: role,
            updatedBy: ctx.participant.username,
          });
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message || 'Failed to assign role.' });
      }
    });

    /**
     * Event: remove_participant
     */
    socket.on('remove_participant', async ({ roomCode: rawCode, targetUserId }) => {
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const ctx = getSocketContext();
        if (!ctx || !ctx.participant) {
          socket.emit('error', { message: 'You are not in an active room session.' });
          return;
        }

        if (!hasPermission(ctx.participant.role, 'remove_participant')) {
          socket.emit('error', {
            message: getPermissionErrorMessage('remove_participant', ctx.participant.role),
          });
          return;
        }

        if (targetUserId === ctx.participant.id) {
          socket.emit('error', { message: 'Host cannot remove themselves from the room.' });
          return;
        }

        const targetParticipant = roomStateStore.getParticipant(roomCode, targetUserId);
        await participantService.removeParticipant(roomCode, targetUserId);

        io.to(`room:${roomCode}`).emit('participant_removed', {
          targetUserId,
          removedBy: ctx.participant.username,
        });

        // Disconnect target socket if connected
        if (targetParticipant?.socketId) {
          const targetSocket = io.sockets.sockets.get(targetParticipant.socketId);
          if (targetSocket) {
            targetSocket.emit('error', { message: 'You have been removed from this watch party by the Host.' });
            targetSocket.leave(`room:${roomCode}`);
          }
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message || 'Failed to remove participant.' });
      }
    });

    /**
     * Event: transfer_host
     */
    socket.on('transfer_host', async ({ roomCode: rawCode, newHostUserId }) => {
      try {
        const roomCode = normalizeRoomCode(rawCode);
        const ctx = getSocketContext();
        if (!ctx || !ctx.participant) {
          socket.emit('error', { message: 'You are not in an active room session.' });
          return;
        }

        if (!hasPermission(ctx.participant.role, 'transfer_host')) {
          socket.emit('error', {
            message: getPermissionErrorMessage('transfer_host', ctx.participant.role),
          });
          return;
        }

        if (newHostUserId === ctx.participant.id) {
          socket.emit('error', { message: 'You are already the room HOST.' });
          return;
        }

        const targetPart = roomStateStore.getParticipant(roomCode, newHostUserId);
        if (!targetPart) {
          socket.emit('error', { message: 'Target user not found in room.' });
          return;
        }

        const success = await participantService.transferHost(roomCode, ctx.participant.id, newHostUserId);
        if (success) {
          io.to(`room:${roomCode}`).emit('host_transferred', {
            oldHostId: ctx.participant.id,
            newHostId: newHostUserId,
            updatedBy: ctx.participant.username,
          });
        } else {
          socket.emit('error', { message: 'Failed to transfer host ownership.' });
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message || 'Failed to transfer host.' });
      }
    });

    /**
     * Event: send_chat_message
     */
    socket.on('send_chat_message', ({ roomCode: rawCode, message }) => {
      const roomCode = normalizeRoomCode(rawCode);
      const ctx = getSocketContext();
      if (!ctx || !ctx.participant) return;

      const cleanMessage = message.trim();
      if (!cleanMessage) return;

      io.to(`room:${roomCode}`).emit('chat_message', {
        id: Math.random().toString(36).substring(2, 9),
        sender: ctx.participant.username,
        message: cleanMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    });

    /**
     * Event: disconnect
     */
    socket.on('disconnect', async () => {
      const mapping = roomStateStore.unmapSocket(socket.id);
      if (mapping) {
        console.log(`[Socket Disconnected] ID: ${socket.id}, User: ${mapping.participantId}`);
        const participant = roomStateStore.getParticipant(mapping.roomCode, mapping.participantId);
        if (participant && participant.role === 'HOST') {
          const nextHost = roomStateStore.findNextHostCandidate(mapping.roomCode, mapping.participantId);
          if (nextHost && nextHost.socketId) {
            await participantService.transferHost(mapping.roomCode, mapping.participantId, nextHost.id);
            console.log(`[SYNC] Host disconnected -> transferred to '${nextHost.username}' (${nextHost.id})`);
            io.to(`room:${mapping.roomCode}`).emit('host_transferred', {
              oldHostId: mapping.participantId,
              newHostId: nextHost.id,
              updatedBy: 'System',
            });
          }
        }
      }
    });
  });
}
