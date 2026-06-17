import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // withCredentials sends the httpOnly ab_token cookie on the WS upgrade request.
    // NOTE: in the Vercel+Render split-domain deployment, this cookie is scoped to the
    // Vercel origin (REST calls are proxied through it — see next.config.js rewrites)
    // and Socket.io connects directly cross-origin to Render, so the cookie never
    // reaches this handshake. Chat won't authenticate until socket auth switches to a
    // token passed explicitly (not cookie-based) or both run under one root domain.
    const backendOrigin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN
      ?? process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')
      ?? 'http://localhost:3001';
    socket = io(backendOrigin, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
