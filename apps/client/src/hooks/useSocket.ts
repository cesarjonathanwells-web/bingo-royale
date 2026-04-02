import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { connectSocket, destroySocket, getSocket } from "@/socket";

/**
 * Manages the Socket.IO connection lifecycle.
 * Connects when authenticated, disconnects on logout.
 * Handles reconnection and room rejoin.
 */
export function useSocket(): void {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setupListeners = useRoomStore((s) => s.setupListeners);
  const cleanupListeners = useRoomStore((s) => s.cleanupListeners);
  const listenersSetup = useRef(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      connectSocket(token);

      if (!listenersSetup.current) {
        setupListeners();
        listenersSetup.current = true;
      }

      const socket = getSocket();

      // On reconnect, re-auth and rejoin room if we were in one
      const handleReconnect = () => {
        if (token) {
          socket.auth = { token };
        }
        // Clear any disconnect error state
        useRoomStore.setState({ error: null });
        // If we were in a room, attempt to rejoin
        const room = useRoomStore.getState().room;
        if (room) {
          socket.emit("room:join", { code: room.code });
        }
      };

      const handleDisconnect = (reason: string) => {
        // Only set error for unexpected disconnects (not user-initiated)
        if (reason !== "io client disconnect") {
          useRoomStore.setState({
            error: "Connection lost. Reconnecting...",
          });
        }
      };

      socket.on("connect", handleReconnect);
      socket.on("disconnect", handleDisconnect);

      return () => {
        socket.off("connect", handleReconnect);
        socket.off("disconnect", handleDisconnect);
      };
    } else {
      if (listenersSetup.current) {
        cleanupListeners();
        listenersSetup.current = false;
      }
      destroySocket();
    }
  }, [isAuthenticated, token, setupListeners, cleanupListeners]);
}
