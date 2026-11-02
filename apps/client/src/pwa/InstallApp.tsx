import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { useInstallStore } from './install-store';

export function InstallApp({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { prompt, installed, updateReady } = useInstallStore();
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  async function install() {
    if (!prompt) { setHelpOpen(true); return; }
    setPending(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      useInstallStore.setState({ prompt: null });
      if (choice.outcome === 'accepted') useInstallStore.setState({ installed: true });
    } catch {
      useInstallStore.setState({ prompt: null });
      setHelpOpen(true);
    } finally { setPending(false); }
  }

  if (compact && installed) return null;
  return (
    <section className={compact ? 'w-full max-w-md rounded-xl glass p-3' : 'rounded-xl glass p-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(installed ? 'pwa.installed' : 'pwa.title')}</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t('pwa.description')}</p>
        </div>
        {!installed && <Button variant="secondary" size="sm" loading={pending} onClick={() => { void install(); }}>{t('pwa.install')}</Button>}
      </div>
      {updateReady && <p className="mt-3 text-xs text-[var(--color-text-secondary)]" role="status">{t('pwa.update')}</p>}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent title={t('pwa.install')} description={t('pwa.helpIntro')}>
          <ol className="list-decimal pl-5 space-y-3 text-sm text-[var(--color-text-secondary)]">
            {(ios ? ['ios1', 'ios2', 'ios3'] : ['other1', 'other2']).map(key => <li key={key}>{t(`pwa.${key}`)}</li>)}
          </ol>
          <p className="mt-4 text-xs text-[var(--color-text-secondary)]">{t('pwa.onlineRequired')}</p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
