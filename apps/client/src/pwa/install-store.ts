import { create } from 'zustand';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
interface InstallState {
  prompt: InstallPrompt | null;
  installed: boolean;
  updateReady: boolean;
}
export const useInstallStore = create<InstallState>(() => ({ prompt: null, installed: false, updateReady: false }));

/** Set up before React renders so the browser's install event is never missed. */
export function initializePwa() {
  const standalone = window.matchMedia('(display-mode: standalone)');
  const checkInstalled = () => useInstallStore.setState({ installed: standalone.matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone) });
  checkInstalled();
  standalone.addEventListener('change', checkInstalled);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    useInstallStore.setState({ prompt: event as InstallPrompt });
  });
  window.addEventListener('appinstalled', () => useInstallStore.setState({ installed: true, prompt: null }));

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const updateStatus = () => useInstallStore.setState({ updateReady: Boolean(registration.waiting) });
      updateStatus();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', updateStatus);
      });
      // Check on returning to the app; activation never reloads an active game.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          void registration.update().catch(() => {});
        }
      });
    } catch {
      // Installation and normal online play still work if storage is unavailable.
    }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => { void register(); }, { once: true });
}
