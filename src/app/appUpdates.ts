import { registerSW } from 'virtual:pwa-register';
import { useToastStore } from '@/state/uiStores';

/** How often an open copy asks whether a new version has been deployed. */
const CHECK_MS = 5 * 60 * 1000;

/**
 * New versions of the deployed app (offline-ready PWA). The app keeps working from its saved copy, so without this an
 * open tab — or the first load after a deploy — runs the previous version. Here it checks every few minutes and when
 * the tab comes back; a new version is used at once if the tab is in the background, otherwise a note offers a
 * reload (work is saved as you go, so reloading loses nothing) and it reloads by itself the next time the tab is left.
 */
export function startAppUpdates(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let offered = false;
  const update = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => undefined);
      setInterval(check, CHECK_MS);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    },
    onNeedRefresh() {
      if (document.visibilityState === 'hidden') return void update(true);
      if (offered) return;
      offered = true;
      useToastStore.getState().push(
        {
          kind: 'info',
          title: 'Neest has been updated',
          message: 'Reload to use the new version. Your work is saved.',
          action: { label: 'Reload', run: () => void update(true) },
        },
        0,
      );
      document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void update(true));
    },
  });
}
