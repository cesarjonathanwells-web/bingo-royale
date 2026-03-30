import { useState, useEffect, useMemo, Suspense } from "react";
import {
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  useParams,
  useNavigate,
} from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { Home } from "@/pages/Home";
import { Room } from "@/pages/Room";
import { Stats } from "@/pages/Stats";
import { useSocket } from "@/hooks/useSocket";
import { useThemeEffect } from "@/hooks/useTheme";
import { useRoomStore } from "@/stores/room-store";

// ============================================================
// Route definitions
// ============================================================

const rootRoute = createRootRoute({
  component: RootLayout,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeWrapper,
});

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/room/$code",
  component: RoomWrapper,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: Stats,
});

const routeTree = rootRoute.addChildren([homeRoute, roomRoute, statsRoute]);

const router = createRouter({ routeTree });

// ============================================================
// Layout
// ============================================================

function RootLayout() {
  useSocket();
  useThemeEffect();

  return (
    <>
      <Header />
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </>
  );
}

// ============================================================
// Route wrappers (handle navigation on room changes)
// ============================================================

function HomeWrapper() {
  const room = useRoomStore((s) => s.room);
  const navigate = useNavigate();

  useEffect(() => {
    if (room) {
      navigate({ to: "/room/$code", params: { code: room.code } });
    }
  }, [room, navigate]);

  return <Home />;
}

function RoomWrapper() {
  const { code } = useParams({ from: "/room/$code" });
  const room = useRoomStore((s) => s.room);
  const navigate = useNavigate();

  useEffect(() => {
    // If room was left (was set then became null), go home
    if (!room) {
      const timeout = setTimeout(() => {
        const currentRoom = useRoomStore.getState().room;
        if (!currentRoom) {
          navigate({ to: "/" });
        }
      }, 2000); // Allow time for join/reconnect
      return () => clearTimeout(timeout);
    }
  }, [room, navigate]);

  return <Room code={code} />;
}

// ============================================================
// App root
// ============================================================

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
