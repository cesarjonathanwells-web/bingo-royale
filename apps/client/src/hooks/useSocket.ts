import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { connectSocket, destroySocket, getSocket } from "@/socket";

/**
 * Manages the Socket.IO connection lifecycle.
 * Connects when authenticated, disconnects on logout.
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

      const handleReconnect = () => {
        if (token) {
          socket.auth = { token };
        }
      };

      socket.on("connect", handleReconnect);

      return () => {
        socket.off("connect", handleReconnect);
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
