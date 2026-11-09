import { useToastStore } from '@/state/uiStores';

/** How often an open copy asks whether a new version has been deployed. */
const CHECK_MS = 5 * 60 * 1000;

/**
 * New versions of the deployed app (offline-ready PWA, vite-plugin-pwa with `registerType: 'autoUpdate'`: a new
 * service worker takes over as soon as it is installed). This registers it, asks for a new version every few minutes
 * and when the tab comes back, and when a new one has taken over: a tab in the background reloads into it at once,
 * a tab in view gets a note with Reload (work is saved as you go) and reloads by itself the next time it is left.
 *
 * (A service worker that waits for every tab to close before taking over — `registerType: 'prompt'` — kept people on
 * the old version even after reloading, so it is not used.)
 */
export function startAppUpdates(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  // The very first install takes control too; only a change from a previous version means new code.
  const hadController = !!sw.controller;
  let offered = false;
  const reload = () => window.location.reload();
  sw.addEventListener('controllerchange', () => {
    if (!hadController || offered) return;
    offered = true;
    if (document.visibilityState === 'hidden') return reload();
    useToastStore.getState().push(
      {
        kind: 'info',
        title: 'Neest has been updated',
        message: 'Reload to use the new version. Your work is saved.',
        action: { label: 'Reload', run: reload },
      },
      0,
    );
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && reload());
  });
  void sw
    .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
    .then((registration) => {
      const check = () => void registration.update().catch(() => undefined);
      setInterval(check, CHECK_MS);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    })
    .catch(() => undefined);
}
