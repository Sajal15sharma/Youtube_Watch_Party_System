import { io, Socket } from 'socket.io-client';

// In production single-service mode, default to same-origin (window.location.origin).
// In local dev with Vite (port 5173), default to http://localhost:5000 unless overridden.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:5000'
    : (typeof window !== 'undefined' ? window.location.origin : ''));

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'], // Support both websocket and HTTP polling behind cloud reverse proxies
});
