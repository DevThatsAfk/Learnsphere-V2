/**
 * socket.ts — socket.io-client setup for LearnSphere v2 chat.
 * Import this singleton to connect to the WebSocket server.
 */
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// Single shared socket instance
export const socket = io(SERVER_URL, {
    autoConnect: false, // connect manually when needed
    withCredentials: true,
});

export function connectSocket(userId: string) {
    if (!socket.connected) {
        socket.connect();
    }
    socket.emit('user:online', { userId });
}

export function disconnectSocket() {
    socket.disconnect();
}
