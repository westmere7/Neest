import { create } from 'zustand';
import { preferenceRepository } from '@/storage/indexeddb/db';
import type { UserVariant } from '@/data/assets/variants';
import type { MaterialDefinition } from '@/domain/model/schema';
import type { AssetCategory } from '@/data/assets/types';
import type { NoteStyle } from '@/features/callouts/style';

/** A group of placed items saved to the library (Furniture → Saved groups), positions relative to its centre. */
export interface SavedGroup {
  id: string;
  name: string;
  /** Optional note shown in the library info card and carried onto placed copies. */
  description?: string;
  /** Ready-made groups shipped with Neest (src/data/groups): their library shelf and room. */
  shelf?: string;
  room?: AssetCategory;
  createdAt: number;
  items: {
    assetId: string;
    name: string | null;
    dx: number;
    dy: number;
    elevation: number;
    rotation: number;
    width: number;
    depth: number;
    height: number;
    mirrored: boolean;
    materials: Record<string, string>;
    /** Model variant (absent = default). */
    model?: string;
  }[];
  /** Plan footprint (metres). */
  size: { w: number; d: number };
  /** Copies of project-only or edited materials used by the items. */
  defs?: Record<string, MaterialDefinition>;
  /** Place the items without grouping them (a duplicated selection that was not a group). */
  ungrouped?: boolean;
}

// ───────────── Theme & preferences ─────────────

export type ThemePref = 'light' | 'dark' | 'system';
/** Library card size: roomy = large cards, normal = the default, dense = small cards. */
export type LibraryDensity = 'roomy' | 'normal' | 'dense';
export const LIBRARY_DENSITIES: LibraryDensity[] = ['roomy', 'normal', 'dense'];

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
  /** 3D view: the orbit pivot eases to the selected objects (off by default). */
  focusSelection: boolean;
  /** Colour variants the user saved, by asset id. */
  assetVariants: Record<string, UserVariant[]>;
  libraryDensity: LibraryDensity;
  /** Groups saved to the library (every project). */
  savedGroups: SavedGroup[];
  /** Style new notes start with ("Set as default" in the note editor); null = the built-in style. */
  noteStyle: NoteStyle | null;
  loaded: boolean;
  setThemePref(p: ThemePref): void;
  syncSystemTheme(): void;
  toggleFavouriteAsset(id: string): void;
  pushRecentAsset(id: string): void;
  toggleFavouriteMaterial(id: string): void;
  pushRecentMaterial(id: string): void;
  dismissOnboarding(): void;
  setRepoSync(on: boolean): void;
  setFocusSelection(on: boolean): void;
  saveAssetVariant(assetId: string, variant: UserVariant): void;
  deleteAssetVariant(assetId: string, id: string): void;
  setLibraryDensity(d: LibraryDensity): void;
  saveGroup(g: SavedGroup): void;
  renameSavedGroup(id: string, name: string): void;
  /** Changes a saved group's name and description (an empty description removes it). */
  updateSavedGroup(id: string, details: { name: string; description: string }): void;
  deleteSavedGroup(id: string): void;
  setNoteStyle(style: NoteStyle | null): void;
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
  focusSelection: false,
  assetVariants: {},
  libraryDensity: 'normal',
  savedGroups: [],
  noteStyle: null,
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
  setFocusSelection(on) {
    set({ focusSelection: on });
    persist('focusSelection', on);
  },
  saveAssetVariant(assetId, variant) {
    const cur = get().assetVariants;
    const next = { ...cur, [assetId]: [...(cur[assetId] ?? []).filter((v) => v.id !== variant.id), variant] };
    set({ assetVariants: next });
    persist('assetVariants', next);
  },
  deleteAssetVariant(assetId, id) {
    const cur = get().assetVariants;
    const list = (cur[assetId] ?? []).filter((v) => v.id !== id);
    const next = { ...cur };
    if (list.length) next[assetId] = list;
    else delete next[assetId];
    set({ assetVariants: next });
    persist('assetVariants', next);
  },
  saveGroup(g) {
    const next = [g, ...get().savedGroups.filter((x) => x.id !== g.id)];
    set({ savedGroups: next });
    persist('savedGroups', next);
  },
  renameSavedGroup(id, name) {
    const next = get().savedGroups.map((g) =>
      g.id === id && name.trim() ? { ...g, name: name.trim().slice(0, 60) } : g,
    );
    set({ savedGroups: next });
    persist('savedGroups', next);
  },
  updateSavedGroup(id, { name, description }) {
    const next = get().savedGroups.map((g) => {
      if (g.id !== id) return g;
      const out: SavedGroup = { ...g, name: name.trim() ? name.trim().slice(0, 60) : g.name };
      const text = description.trim().slice(0, 500);
      if (text) out.description = text;
      else delete out.description;
      return out;
    });
    set({ savedGroups: next });
    persist('savedGroups', next);
  },
  deleteSavedGroup(id) {
    const next = get().savedGroups.filter((g) => g.id !== id);
    set({ savedGroups: next });
    persist('savedGroups', next);
  },
  setLibraryDensity(d) {
    set({ libraryDensity: d });
    persist('libraryDensity', d);
  },
  setNoteStyle(style) {
    set({ noteStyle: style });
    persist('noteStyle', style);
  },
  async hydrate() {
    try {
      const [fa, ra, fm, rm, ob, rs, av, ld, sg, fs, ns] = await Promise.all([
        preferenceRepository.get<string[]>('favouriteAssets'),
        preferenceRepository.get<string[]>('recentAssets'),
        preferenceRepository.get<string[]>('favouriteMaterials'),
        preferenceRepository.get<string[]>('recentMaterials'),
        preferenceRepository.get<boolean>('onboardingDismissed'),
        preferenceRepository.get<boolean>('repoSync'),
        preferenceRepository.get<Record<string, UserVariant[]>>('assetVariants'),
        preferenceRepository.get<LibraryDensity>('libraryDensity'),
        preferenceRepository.get<SavedGroup[]>('savedGroups'),
        preferenceRepository.get<boolean>('focusSelection'),
        preferenceRepository.get<NoteStyle | null>('noteStyle'),
      ]);
      set({
        favouriteAssets: fa ?? [],
        recentAssets: ra ?? [],
        favouriteMaterials: fm ?? [],
        recentMaterials: rm ?? [],
        onboardingDismissed: ob ?? false,
        repoSync: rs ?? true,
        focusSelection: fs ?? false,
        assetVariants: av && typeof av === 'object' ? av : {},
        libraryDensity: ld && LIBRARY_DENSITIES.includes(ld) ? ld : 'normal',
        savedGroups: Array.isArray(sg) ? sg : [],
        noteStyle: ns && typeof ns === 'object' ? ns : null,
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
  success: (title: string, message?: string) =>
    useToastStore.getState().push({ kind: 'success', title, message }),
  warning: (title: string, message?: string) =>
    useToastStore.getState().push({ kind: 'warning', title, message }),
  error: (title: string, message?: string) =>
    useToastStore.getState().push({ kind: 'error', title, message }),
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
