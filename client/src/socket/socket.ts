import { io, Socket } from 'socket.io-client';

// Connect directly to backend server (port 5000 in dev) to avoid Vite ws proxy drops
const SOCKET_URL =
  import.meta.env.VITE_SERVER_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin);

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
