import { io, Socket } from "socket.io-client";

const URL =
  import.meta.env.MODE === "production"
    ? window.location.origin
    : "http://localhost:3000";

let socket: Socket | null = null;

/**
 * Get or create the Socket.IO client instance.
 * Lazily created on first call; reused thereafter.
 */
export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem("bingo-token");
    socket = io(URL, {
      autoConnect: false,
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

/**
 * Connect to the server (if not already connected).
 * Updates auth token before connecting.
 */
export function connectSocket(token: string): void {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) {
    s.connect();
  }
}

/**
 * Disconnect from the server.
 */
export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

/**
 * Destroy the socket instance entirely (used on logout).
 */
export function destroySocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
