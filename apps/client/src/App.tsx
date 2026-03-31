import { useEffect, useRef, Suspense } from "react";
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
import { BottomNav } from "@/components/layout/BottomNav";
import { ToastProvider } from "@/components/ui/Toast";
import { Home } from "@/pages/Home";
import { Room } from "@/pages/Room";
import { Stats } from "@/pages/Stats";
import { Profile } from "@/pages/Profile";
import { Settings } from "@/pages/Settings";
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

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile/$userId",
  component: ProfileWrapper,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
});

const routeTree = rootRoute.addChildren([homeRoute, roomRoute, statsRoute, profileRoute, settingsRoute]);

const router = createRouter({ routeTree });

// ============================================================
// Layout
// ============================================================

function RootLayout() {
  useSocket();
  useThemeEffect();
  const room = useRoomStore((s) => s.room);
  const isInGame = room?.state === "in_progress";

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {!isInGame && <Header />}
      <main className="flex-1 flex flex-col">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      {!isInGame && <BottomNav />}
    </div>
  );
}

// ============================================================
// Route wrappers (handle navigation on room changes)
// ============================================================

function HomeWrapper() {
  const room = useRoomStore((s) => s.room);
  const navigate = useNavigate();
  const prevRoom = useRef<string | null>(null);

  useEffect(() => {
    // Only navigate to room if a NEW room appeared (not leftover state)
    if (room && room.code !== prevRoom.current) {
      prevRoom.current = room.code;
      navigate({ to: "/room/$code", params: { code: room.code } });
    }
    if (!room) {
      prevRoom.current = null;
    }
  }, [room, navigate]);

  return <Home />;
}

function RoomWrapper() {
  const { code } = useParams({ from: "/room/$code" });
  const room = useRoomStore((s) => s.room);
  const navigate = useNavigate();
  const hasJoined = useRef(false);

  useEffect(() => {
    if (room) {
      hasJoined.current = true;
    } else if (hasJoined.current) {
      // Room was set then cleared = we left. Navigate home immediately.
      navigate({ to: "/" });
    } else {
      // Never had a room - this is a direct URL navigation.
      // Give time for the join to complete.
      const timeout = setTimeout(() => {
        if (!useRoomStore.getState().room) {
          navigate({ to: "/" });
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [room, navigate]);

  return <Room code={code} />;
}

function ProfileWrapper() {
  const { userId } = useParams({ from: "/profile/$userId" });
  return <Profile userId={userId} />;
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
