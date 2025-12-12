'use client';

import { io, Socket } from 'socket.io-client';

const NOTIFICATION_SERVICE = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:3003';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(NOTIFICATION_SERVICE, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const connectSocket = (userId: string) => {
  const socketInstance = getSocket();
  
  if (!socketInstance.connected) {
    socketInstance.auth = { userId };
    socketInstance.connect();
  }
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};
