import { useEffect, useState, useCallback, useRef } from 'react';
import { socket } from '../socket/socket';
import { ChatMessage, Participant, Role, RoomStatePayload } from '../types/index';

export function useSocket(roomCode: string, username: string, initialParticipantId?: string) {
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [roomState, setRoomState] = useState<RoomStatePayload['room'] | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Track participant ID across re-connects
  const participantIdRef = useRef<string | undefined>(initialParticipantId);
  participantIdRef.current = initialParticipantId || participantIdRef.current;

  // Measured client-server clock offset via sync_ping/sync_pong
  const clockOffsetRef = useRef<number>(0);
  const getServerTime = useCallback(() => Date.now() + clockOffsetRef.current, []);

  useEffect(() => {
    if (!roomCode || !username) return;

    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('join_room', {
        roomCode,
        username,
        participantId: participantIdRef.current,
      });
      // Ping server immediately to calibrate clock offset
      socket.emit('sync_ping', { clientTime: Date.now() });
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onRoomState = (payload: RoomStatePayload) => {
      console.log(`[SYNC] Client received 'room_state': room=${payload.room.roomCode}, videoId=${payload.room.currentVideoId}, time=${payload.room.currentPlaybackTime}, state=${payload.room.currentPlaybackState}, lastUpdated=${payload.room.lastUpdated}`);
      setRoomState(payload.room);
      setParticipants(payload.participants);
      setCurrentUser(payload.currentUser);
      participantIdRef.current = payload.currentUser.id;
      // Store in localStorage for seamless reconnection
      localStorage.setItem(`yt_party_user_${roomCode}`, JSON.stringify({
        participantId: payload.currentUser.id,
        username: payload.currentUser.username,
      }));
    };

    const onUserJoined = ({ participant }: { participant: Participant }) => {
      setParticipants((prev) => {
        const exists = prev.some((p) => p.id === participant.id);
        if (exists) return prev.map((p) => (p.id === participant.id ? participant : p));
        return [...prev, participant];
      });
    };

    const onUserLeft = ({ participantId }: { participantId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    };

    const onPlay = ({ time, videoId, updatedAtServerTime }: { time: number; videoId: string | null; updatedAtServerTime?: number }) => {
      const serverStamp = updatedAtServerTime || Date.now();
      console.log(`[SYNC] Client received 'play' broadcast: time=${time}, videoId=${videoId}, serverTime=${serverStamp}`);
      setRoomState((prev) =>
        prev
          ? { ...prev, currentPlaybackState: 'playing', currentPlaybackTime: time, currentVideoId: videoId, lastUpdated: serverStamp }
          : null
      );
    };

    const onPause = ({ time, videoId, updatedAtServerTime }: { time: number; videoId: string | null; updatedAtServerTime?: number }) => {
      const serverStamp = updatedAtServerTime || Date.now();
      console.log(`[SYNC] Client received 'pause' broadcast: time=${time}, videoId=${videoId}, serverTime=${serverStamp}`);
      setRoomState((prev) =>
        prev
          ? { ...prev, currentPlaybackState: 'paused', currentPlaybackTime: time, currentVideoId: videoId, lastUpdated: serverStamp }
          : null
      );
    };

    const onSeek = ({ time, updatedAtServerTime }: { time: number; updatedAtServerTime?: number }) => {
      const serverStamp = updatedAtServerTime || Date.now();
      console.log(`[SYNC] Client received 'seek' broadcast: time=${time}, serverTime=${serverStamp}`);
      setRoomState((prev) =>
        prev ? { ...prev, currentPlaybackTime: time, lastUpdated: serverStamp } : null
      );
    };

    const onVideoChanged = ({ videoId, time, updatedAtServerTime }: { videoId: string; time: number; updatedAtServerTime?: number }) => {
      const serverStamp = updatedAtServerTime || Date.now();
      console.log(`[SYNC] Client received 'video_changed' broadcast: videoId=${videoId}, time=${time}, serverTime=${serverStamp}`);
      setRoomState((prev) =>
        prev
          ? {
              ...prev,
              currentVideoId: videoId,
              currentPlaybackTime: time,
              currentPlaybackState: 'paused',
              lastUpdated: serverStamp,
            }
          : null
      );
    };

    const onSyncPong = ({ clientTime, serverTime }: { clientTime: number; serverTime: number }) => {
      const now = Date.now();
      const rtt = Math.max(0, now - clientTime);
      clockOffsetRef.current = serverTime + (rtt / 2) - now;
      console.log(`[SYNC] Clock offset calibrated: offset=${clockOffsetRef.current.toFixed(1)}ms (rtt=${rtt}ms)`);
    };

    const onSyncHeartbeat = ({ time, isPlaying, updatedAtServerTime }: { time: number; isPlaying: boolean; updatedAtServerTime: number }) => {
      setRoomState((prev) =>
        prev
          ? {
              ...prev,
              currentPlaybackTime: time,
              currentPlaybackState: isPlaying ? 'playing' : 'paused',
              lastUpdated: updatedAtServerTime,
            }
          : null
      );
    };

    const onRoleAssigned = ({ targetUserId, newRole }: { targetUserId: string; newRole: Role }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === targetUserId ? { ...p, role: newRole } : p))
      );
      setCurrentUser((prev) => (prev && prev.id === targetUserId ? { ...prev, role: newRole } : prev));
    };

    const onParticipantRemoved = ({ targetUserId }: { targetUserId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== targetUserId));
    };

    const onHostTransferred = ({ oldHostId, newHostId }: { oldHostId: string; newHostId: string }) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.id === oldHostId) return { ...p, role: 'MODERATOR' as Role };
          if (p.id === newHostId) return { ...p, role: 'HOST' as Role };
          return p;
        })
      );
      setCurrentUser((prev) => {
        if (!prev) return null;
        if (prev.id === oldHostId) return { ...prev, role: 'MODERATOR' };
        if (prev.id === newHostId) return { ...prev, role: 'HOST' };
        return prev;
      });
      setRoomState((prev) => (prev ? { ...prev, hostUserId: newHostId } : null));
    };

    const onChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    const onError = ({ message }: { message: string }) => {
      setErrorMessage(message);
      // Auto dismiss error message after 4 seconds
      setTimeout(() => setErrorMessage(null), 4000);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_state', onRoomState);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('play', onPlay);
    socket.on('pause', onPause);
    socket.on('seek', onSeek);
    socket.on('video_changed', onVideoChanged);
    socket.on('role_assigned', onRoleAssigned);
    socket.on('participant_removed', onParticipantRemoved);
    socket.on('host_transferred', onHostTransferred);
    socket.on('chat_message', onChatMessage);
    socket.on('error', onError);
    socket.on('sync_pong', onSyncPong);
    socket.on('sync_heartbeat', onSyncHeartbeat);

    // Periodically re-calibrate ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('sync_ping', { clientTime: Date.now() });
      }
    }, 30000);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      clearInterval(pingInterval);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_state', onRoomState);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('play', onPlay);
      socket.off('pause', onPause);
      socket.off('seek', onSeek);
      socket.off('video_changed', onVideoChanged);
      socket.off('role_assigned', onRoleAssigned);
      socket.off('participant_removed', onParticipantRemoved);
      socket.off('host_transferred', onHostTransferred);
      socket.off('chat_message', onChatMessage);
      socket.off('error', onError);
      socket.off('sync_pong', onSyncPong);
      socket.off('sync_heartbeat', onSyncHeartbeat);
    };
  }, [roomCode, username]);

  // Action Emitters
  const emitPlay = useCallback((time?: number) => {
    console.log(`[SYNC] Client socket emit 'play': time=${time}`);
    socket.emit('play', { roomCode, time });
  }, [roomCode]);

  const emitPause = useCallback((time?: number) => {
    console.log(`[SYNC] Client socket emit 'pause': time=${time}`);
    socket.emit('pause', { roomCode, time });
  }, [roomCode]);

  const emitSeek = useCallback((time: number) => {
    console.log(`[SYNC] Client socket emit 'seek': time=${time}`);
    socket.emit('seek', { roomCode, time });
  }, [roomCode]);

  const emitChangeVideo = useCallback((videoId: string) => {
    console.log(`[SYNC] Client socket emit 'change_video': videoId=${videoId}`);
    socket.emit('change_video', { roomCode, videoId });
  }, [roomCode]);

  const emitAssignRole = useCallback((targetUserId: string, role: Role) => {
    socket.emit('assign_role', { roomCode, targetUserId, role });
  }, [roomCode]);

  const emitRemoveParticipant = useCallback((targetUserId: string) => {
    socket.emit('remove_participant', { roomCode, targetUserId });
  }, [roomCode]);

  const emitTransferHost = useCallback((newHostUserId: string) => {
    socket.emit('transfer_host', { roomCode, newHostUserId });
  }, [roomCode]);

  const emitChatMessage = useCallback((message: string) => {
    socket.emit('send_chat_message', { roomCode, message });
  }, [roomCode]);

  const emitHeartbeat = useCallback((time: number, isPlaying: boolean) => {
    socket.emit('sync_heartbeat', { roomCode, time, isPlaying });
  }, [roomCode]);

  const leaveRoom = useCallback(() => {
    socket.emit('leave_room', { roomCode });
  }, [roomCode]);

  return {
    isConnected,
    roomState,
    participants,
    currentUser,
    errorMessage,
    chatMessages,
    emitPlay,
    emitPause,
    emitSeek,
    emitChangeVideo,
    emitAssignRole,
    emitRemoveParticipant,
    emitTransferHost,
    emitChatMessage,
    emitHeartbeat,
    getServerTime,
    leaveRoom,
  };
}
