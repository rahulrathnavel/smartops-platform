import { io } from 'socket.io-client';

// Connect to the same origin — nginx proxies /socket.io/ to the dashboard-backend
// This works in both dev (localhost:4000) and production (LB hostname via nginx proxy)
const backendUrl = window.location.hostname === 'localhost'
  ? 'http://localhost:4000'
  : window.location.origin;  // Same origin — nginx handles the proxy

export const socket = io(backendUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 2000,
  path: '/socket.io/',
});
