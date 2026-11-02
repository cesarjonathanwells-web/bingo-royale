import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function ConnectionStatus() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (online) return null;
  return <div role="status" className="fixed left-3 right-3 z-[60] mx-auto max-w-md rounded-xl border border-amber-400/40 bg-[var(--color-bg-secondary)] px-4 py-3 text-center text-sm text-[var(--color-text-primary)] shadow-lg pointer-events-none"
    style={{ top: 'calc(env(safe-area-inset-top) + 3.5rem)' }}>{t('pwa.offline')}</div>;
}
