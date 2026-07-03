import { io, Socket } from 'socket.io-client';
import { api } from './api';

const BACKEND_ORIGIN = process.env.EXPO_PUBLIC_BACKEND_ORIGIN ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_ORIGIN, {
      transports: ['websocket'],
      autoConnect: false,
      auth: async (cb: (data: { token: string }) => void) => {
        try {
          const { token } = await api.get('/auth/socket-token') as any;
          cb({ token });
        } catch {
          cb({ token: '' });
        }
      },
    });
  }
  return socket;
}

export function connectSocket() {
  getSocket().connect();
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
