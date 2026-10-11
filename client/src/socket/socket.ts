import { io, Socket } from 'socket.io-client';

// Support VITE_SOCKET_URL or VITE_SERVER_URL for production (e.g. Render/Railway)
// Fallback to localhost:5000 in local dev or window.location.origin
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'], // Support both websocket and HTTP polling behind cloud reverse proxies
});
