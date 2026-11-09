import { useToastStore } from '@/state/uiStores';

/** How often an open copy asks whether a new version has been deployed. */
const CHECK_MS = 5 * 60 * 1000;

let holds = 0;
let pending = false;
const reload = () => window.location.reload();

/** Reloads into the new version, unless something long is running: then it waits until that is done. */
function reloadWhenFree(): void {
  if (holds > 0) pending = true;
  else reload();
}

/**
 * Keeps the page from reloading into a new version while long work runs (publishing a live link, packaging an
 * export): on a phone, switching apps while a publish was sending reloaded the tab and lost it. Returns the release;
 * a reload that was held back happens then if the tab is out of view (a tab in view keeps its Reload note).
 */
export function holdReload(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    if (!holds && pending && document.visibilityState === 'hidden') {
      pending = false;
      reload();
    }
  };
}

/**
 * New versions of the deployed app (offline-ready PWA, vite-plugin-pwa with `registerType: 'autoUpdate'`: a new
 * service worker takes over as soon as it is installed). This registers it, asks for a new version every few minutes
 * and when the tab comes back, and when a new one has taken over: a tab in the background reloads into it at once,
 * a tab in view gets a note with Reload (work is saved as you go) and reloads by itself the next time it is left —
 * in both cases not while long work holds it (`holdReload`).
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
  sw.addEventListener('controllerchange', () => {
    if (!hadController || offered) return;
    offered = true;
    if (document.visibilityState === 'hidden') return reloadWhenFree();
    useToastStore.getState().push(
      {
        kind: 'info',
        title: 'Neest has been updated',
        message: 'Reload to use the new version. Your work is saved.',
        action: { label: 'Reload', run: reload },
      },
      0,
    );
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && reloadWhenFree());
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

/**
 * Keeps the screen on while long work runs (Screen Wake Lock, where the browser has it): a phone that locks its screen
 * puts the page in the background, where uploads slow down or stop. Returns the release.
 */
export async function keepScreenOn(): Promise<() => void> {
  const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
  try {
    const lock = await nav.wakeLock?.request('screen');
    return () => void lock?.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}
