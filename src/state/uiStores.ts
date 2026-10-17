import { create } from 'zustand';
import { preferenceRepository } from '@/storage/indexeddb/db';

// ───────────── Theme & preferences ─────────────

export type ThemePref = 'light' | 'dark' | 'system';

const THEME_KEY = 'neest.theme';

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') return systemDark() ? 'dark' : 'light';
  return pref;
}

interface PrefsState {
  themePref: ThemePref;
  theme: 'light' | 'dark';
  favouriteAssets: string[];
  recentAssets: string[];
  favouriteMaterials: string[];
  recentMaterials: string[];
  onboardingDismissed: boolean;
  /** Mirror projects into the repository projects/ folder when served by the dev server. */
  repoSync: boolean;
  loaded: boolean;
  setThemePref(p: ThemePref): void;
  syncSystemTheme(): void;
  toggleFavouriteAsset(id: string): void;
  pushRecentAsset(id: string): void;
  toggleFavouriteMaterial(id: string): void;
  pushRecentMaterial(id: string): void;
  dismissOnboarding(): void;
  setRepoSync(on: boolean): void;
  hydrate(): Promise<void>;
}

const persist = (key: string, value: unknown) => {
  preferenceRepository.set(key, value).catch(() => undefined);
};

export const usePrefsStore = create<PrefsState>((set, get) => ({
  themePref: readThemePref(),
  theme: resolveTheme(readThemePref()),
  favouriteAssets: [],
  recentAssets: [],
  favouriteMaterials: [],
  recentMaterials: [],
  onboardingDismissed: false,
  repoSync: true,
  loaded: false,
  setThemePref(p) {
    try {
      localStorage.setItem(THEME_KEY, p);
    } catch {
      /* ignore */
    }
    const theme = resolveTheme(p);
    document.documentElement.dataset.theme = theme;
    set({ themePref: p, theme });
  },
  syncSystemTheme() {
    const { themePref } = get();
    if (themePref !== 'system') return;
    const theme = resolveTheme('system');
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  toggleFavouriteAsset(id) {
    const cur = get().favouriteAssets;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
    set({ favouriteAssets: next });
    persist('favouriteAssets', next);
  },
  pushRecentAsset(id) {
    const next = [id, ...get().recentAssets.filter((x) => x !== id)].slice(0, 12);
    set({ recentAssets: next });
    persist('recentAssets', next);
  },
  toggleFavouriteMaterial(id) {
    const cur = get().favouriteMaterials;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
    set({ favouriteMaterials: next });
    persist('favouriteMaterials', next);
  },
  pushRecentMaterial(id) {
    const next = [id, ...get().recentMaterials.filter((x) => x !== id)].slice(0, 12);
    set({ recentMaterials: next });
    persist('recentMaterials', next);
  },
  dismissOnboarding() {
    set({ onboardingDismissed: true });
    persist('onboardingDismissed', true);
  },
  setRepoSync(on) {
    set({ repoSync: on });
    persist('repoSync', on);
  },
  async hydrate() {
    try {
      const [fa, ra, fm, rm, ob, rs] = await Promise.all([
        preferenceRepository.get<string[]>('favouriteAssets'),
        preferenceRepository.get<string[]>('recentAssets'),
        preferenceRepository.get<string[]>('favouriteMaterials'),
        preferenceRepository.get<string[]>('recentMaterials'),
        preferenceRepository.get<boolean>('onboardingDismissed'),
        preferenceRepository.get<boolean>('repoSync'),
      ]);
      set({
        favouriteAssets: fa ?? [],
        recentAssets: ra ?? [],
        favouriteMaterials: fm ?? [],
        recentMaterials: rm ?? [],
        onboardingDismissed: ob ?? false,
        repoSync: rs ?? true,
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },
}));

// ───────────── Toasts ─────────────

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  push(t: Omit<Toast, 'id'>, timeoutMs?: number): number;
  dismiss(id: number): void;
}

let toastSeq = 1;
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push(t, timeoutMs = t.kind === 'error' ? 9000 : 4200) {
    const id = toastSeq++;
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    if (timeoutMs > 0) setTimeout(() => get().dismiss(id), timeoutMs);
    return id;
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((x) => x.id !== id) });
  },
}));

export const toast = {
  info: (title: string, message?: string) => useToastStore.getState().push({ kind: 'info', title, message }),
  success: (title: string, message?: string) => useToastStore.getState().push({ kind: 'success', title, message }),
  warning: (title: string, message?: string) => useToastStore.getState().push({ kind: 'warning', title, message }),
  error: (title: string, message?: string) => useToastStore.getState().push({ kind: 'error', title, message }),
};

// ───────────── Confirm / prompt dialogs ─────────────

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve(ok: boolean): void;
}

interface DialogState {
  confirm: ConfirmRequest | null;
  openDialog: string | null;
  dialogProps: Record<string, unknown>;
  ask(req: Omit<ConfirmRequest, 'resolve'>): Promise<boolean>;
  open(name: string, props?: Record<string, unknown>): void;
  close(): void;
}

export const useDialogStore = create<DialogState>((set) => ({
  confirm: null,
  openDialog: null,
  dialogProps: {},
  ask(req) {
    return new Promise<boolean>((resolve) => {
      set({
        confirm: {
          ...req,
          resolve: (ok) => {
            set({ confirm: null });
            resolve(ok);
          },
        },
      });
    });
  },
  open(name, props = {}) {
    set({ openDialog: name, dialogProps: props });
  },
  close() {
    set({ openDialog: null, dialogProps: {} });
  },
}));

export const confirmAction = (req: Omit<ConfirmRequest, 'resolve'>) => useDialogStore.getState().ask(req);
