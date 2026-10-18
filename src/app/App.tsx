import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { ContextMenuHost } from '@/components/ContextMenu';
import { ConfirmHost, ToastHost } from '@/components/Overlays';
import { usePrefsStore } from '@/state/uiStores';
import { Launcher } from '@/features/projects/Launcher';
import './app.css';

const EditorPage = lazy(() => import('@/features/editor/EditorPage'));
const GuestPage = lazy(() => import('@/features/walkthrough/GuestPage'));

export type Route = { name: 'home' } | { name: 'editor'; id: string } | { name: 'guest'; id: string };

export function parseRoute(hash: string): Route {
  const m = hash.match(/^#\/(p|guest)\/([\w-]+)/);
  if (m) return m[1] === 'p' ? { name: 'editor', id: m[2] } : { name: 'guest', id: m[2] };
  return { name: 'home' };
}

export function navigate(to: string) {
  window.location.hash = to;
}

function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function App() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  const route = parseRoute(hash);
  const syncSystemTheme = usePrefsStore((s) => s.syncSystemTheme);
  const hydrate = usePrefsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', syncSystemTheme);
    return () => mq?.removeEventListener?.('change', syncSystemTheme);
  }, [hydrate, syncSystemTheme]);

  // Browser defaults that fight the editor: Alt (focuses the browser menu, Alt+arrows navigate away)
  // and the browser's own right-click menu (the app shows its own; text fields keep theirs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home'))) e.preventDefault();
    };
    const onMenu = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"], .allow-native-menu')) return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('contextmenu', onMenu);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('contextmenu', onMenu);
    };
  }, []);

  return (
    <>
      <Suspense fallback={<div className="app-loading">Loading Neest…</div>}>
        {route.name === 'home' && <Launcher />}
        {route.name === 'editor' && <EditorPage key={route.id} projectId={route.id} />}
        {route.name === 'guest' && <GuestPage key={route.id} projectId={route.id} />}
      </Suspense>
      <ContextMenuHost />
      <ConfirmHost />
      <ToastHost />
    </>
  );
}
