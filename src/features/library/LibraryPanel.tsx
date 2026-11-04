import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { openContextMenu } from '@/components/ContextMenu';
import { copyReadyGroup, editSavedGroupDetails, removeSavedGroup } from './SavedGroups';
import { renameGenericSavedGroups } from '@/features/editor/groups';
import { READY_GROUP_SHELVES, readyGroupById, readyGroups } from '@/data/groups/readyGroups';
import { SAVED_GROUP_PREFIX, savedGroupAssets } from './savedGroupAssets';
import { collectionMenuItems, editCollection, newCollection, removeCollection } from './collections';
import {
  Archive,
  Armchair,
  Baby,
  Bath,
  Bed,
  BedDouble,
  Blinds,
  Box,
  Clock,
  Columns2,
  Component,
  CookingPot,
  Dumbbell,
  Folder,
  FolderHeart,
  Frame,
  Grid2x2,
  Grid3x3,
  Lamp,
  LayoutGrid,
  List,
  Monitor,
  PawPrint,
  Pencil,
  Refrigerator,
  Search,
  ShowerHead,
  Sofa,
  Sprout,
  Star,
  Sun,
  Table2,
  Trash2,
  Tv,
  Upload,
  User,
  Utensils,
  WashingMachine,
  X,
} from 'lucide-react';
import type { OpeningKind, WallRole } from '@/domain/model/schema';
import { OPENING_PRESETS } from '@/domain/model/defaults';
import { formatLength } from '@/domain/model/units';
import {
  ASSET_CATALOG,
  ASSET_CATEGORY_LABELS,
  ASSET_TYPE_LABELS,
  ASSET_TYPE_ORDER,
  groupRank,
} from '@/data/assets/catalog';
import {
  FURNITURE_CATEGORY_BY_ID,
  ITEM_CATEGORIES,
  ROOM_CATEGORIES,
  categoryShelfRank,
  furnitureCategoriesOf,
  furnitureCategorySearchText,
  isFurnitureCategoryId,
  primaryItemCategoryOf,
  type FurnitureCategoryId,
} from '@/data/assets/furnitureCategories';
import { assetPlan, customAssetDefinition, getAsset } from '@/data/assets/registry';
import { plantSearchText } from '@/data/assets/plantInfo';
import type { AssetDefinition } from '@/data/assets/types';
import { usePackVersion } from '@/packs/events';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore, type LibraryTab } from '@/state/editorStore';
import { LIBRARY_DENSITIES, useDialogStore, usePrefsStore, type LibraryDensity } from '@/state/uiStores';
import { IconButton, Segmented } from '@/components/ui';
import { polyPath } from '@/features/plan-2d/PlanDrawing';
import { MaterialLibrary, SearchClear, searchKeyDown } from '@/features/materials/MaterialUI';
import { useAssetThumbnail } from './thumbnails';
import { CardModelButton, useChosenModel } from './ModelPicker';
import { withModel } from '@/data/assets/models';
import { AssetInfoCard, InfoCardControl } from './AssetInfoCard';
import { DOOR_KINDS, WINDOW_KINDS, WallPresetCards, extraOpeningIcon } from './BuildExtras';
import { OpeningBuildOptions } from './OpeningBuildOptions';
import './library.css';
import { CategoryButton, CategoryHeading, CategoryRail, useRailCollapsed } from './CategoryRail';
import { servicesSearchText } from '@/domain/model/services';
import { toUi } from '@/components/uiScale';

const BUILD_GROUP_TITLES = {
  walls: 'Walls',
  doors: 'Doors',
  windows: 'Windows',
} as const;

const DENSITY_LABELS: Record<LibraryDensity, string> = { roomy: 'Large', normal: 'Medium', dense: 'Small' };
const DENSITY_ICONS = { roomy: Grid2x2, normal: LayoutGrid, dense: Grid3x3 } satisfies Record<
  LibraryDensity,
  unknown
>;

/** Cycles the library's card size: large → medium (default) → small. */
function DensityButton() {
  const density = usePrefsStore((s) => s.libraryDensity);
  const next = LIBRARY_DENSITIES[(LIBRARY_DENSITIES.indexOf(density) + 1) % LIBRARY_DENSITIES.length];
  const Icon = DENSITY_ICONS[density];
  return (
    <IconButton
      label={`Card size: ${DENSITY_LABELS[density]} (switch to ${DENSITY_LABELS[next].toLowerCase()})`}
      onClick={() => usePrefsStore.getState().setLibraryDensity(next)}
      data-testid="library-density"
    >
      <Icon size={16} />
    </IconButton>
  );
}

/** Materials tab: swatch grid (default) or list. */
function MaterialViewButton() {
  const view = usePrefsStore((s) => s.materialView);
  return (
    <IconButton
      label={view === 'grid' ? 'Show materials as a list' : 'Show materials as a grid'}
      onClick={() => usePrefsStore.getState().setMaterialView(view === 'grid' ? 'list' : 'grid')}
      data-testid="material-view"
    >
      {view === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />}
    </IconButton>
  );
}

/**
 * Memoised: the editor shell re-renders on every project change (each pointer move while dragging),
 * and the library, with hundreds of cards, only depends on its own store slices.
 */
export const LibraryPanel = memo(function LibraryPanel({ isMobile }: { isMobile: boolean }) {
  const tab = useEditorStore((s) => s.libraryTab);
  const buildGroup = useEditorStore((s) => s.buildGroup);
  const width = useEditorStore((s) => s.libraryWidth);
  const set = useEditorStore((s) => s.set);
  const workspace = useEditorStore((s) => s.workspace);
  const density = usePrefsStore((s) => s.libraryDensity);
  const resizing = useRef<{ x: number; w: number } | null>(null);
  const tabs: { value: LibraryTab; label: string }[] = [
    { value: 'furniture', label: 'Furniture' },
    { value: 'materials', label: 'Materials' },
  ];
  const current = isMobile && tab === 'build' ? 'furniture' : tab;
  return (
    <aside
      className={`library floating${isMobile ? ' sheet' : ''}${workspace === '3d' ? ' in-3d' : ''}`}
      style={isMobile ? undefined : { width }}
      aria-label="Library"
      data-testid="library"
      data-density={density}
    >
      <header className="library-head">
        {current === 'build' ? (
          <strong className="library-group-title">{BUILD_GROUP_TITLES[buildGroup]}</strong>
        ) : (
          <Segmented
            label="Library section"
            size="sm"
            value={current}
            onChange={(v) => set({ libraryTab: v })}
            options={tabs.map((t) => ({ ...t, testId: `lib-tab-${t.value}` }))}
          />
        )}
        <div className="library-head-actions">
          {current === 'materials' ? <MaterialViewButton /> : <DensityButton />}
          <IconButton label="Close library" onClick={() => set({ libraryOpen: false })}>
            <X size={16} />
          </IconButton>
        </div>
      </header>
      <div className="library-body">
        {current === 'build' && <BuildTab />}
        {current === 'furniture' && <FurnitureTab isMobile={isMobile} />}
        {current === 'materials' && <MaterialLibrary />}
      </div>
      {!isMobile && (
        <div
          className="resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize library"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') set({ libraryWidth: Math.max(330, width - 20) });
            if (e.key === 'ArrowRight') set({ libraryWidth: Math.min(640, width + 20) });
          }}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            resizing.current = { x: e.clientX, w: width };
          }}
          onPointerMove={(e) => {
            if (!resizing.current) return;
            set({
              // The pointer moves in screen pixels; the panel is sized in its scaled pixels.
              libraryWidth: Math.min(640, Math.max(330, resizing.current.w + toUi(e.clientX - resizing.current.x))),
            });
          }}
          onPointerUp={() => (resizing.current = null)}
        />
      )}
    </aside>
  );
});

// ───────────── Build tab (grouped by toolrail icon) ─────────────

function WallIcon({ t }: { t: number }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden>
      <rect x="4" y={20 - t} width="32" height={t * 2} rx="1" fill="currentColor" />
    </svg>
  );
}

function OpeningIcon({ kind }: { kind: OpeningKind }) {
  const win = kind.startsWith('window');
  return (
    <svg viewBox="0 0 40 40" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 24h8M30 24h8" strokeWidth="5" />
      {win ? (
        <>
          <path d="M10 22h20M10 26h20" />
          {kind === 'window-double' && <path d="M20 21v6" />}
        </>
      ) : kind === 'door-sliding' ? (
        <>
          <path d="M10 23h12M18 25.5h12" strokeWidth="2.2" />
        </>
      ) : kind === 'passage' ? (
        <path d="M10 22h20M10 26h20" strokeDasharray="2 2" />
      ) : kind === 'door-double' ? (
        <>
          <path d="M10 24V14M30 24V14" strokeWidth="2" />
          <path d="M10 14a10 10 0 0 1 10 10M30 14a10 10 0 0 0-10 10" strokeWidth="1" />
        </>
      ) : (
        <>
          <path d="M10 24V4" strokeWidth="2" />
          <path d="M10 4a20 20 0 0 1 20 20" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

function BuildTab() {
  const tool = useEditorStore((s) => s.tool);
  const role = useEditorStore((s) => s.wallRole);
  const kind = useEditorStore((s) => s.openingKind);
  const buildGroup = useEditorStore((s) => s.buildGroup);
  const wallPreset = useEditorStore((s) => s.wallPreset);
  const settings = useProjectStore((s) => s.project!.settings);
  const set = useEditorStore((s) => s.set);
  const wallCard = (r: WallRole, label: string, t: number, toolId: 'wall' | 'room' | 'curve' = 'wall') => {
    const active = tool === toolId && role === r && !wallPreset;
    return (
      <button
        key={`${toolId}-${r}`}
        type="button"
        className={`build-card${active ? ' on' : ''}`}
        onClick={() => set({ tool: toolId, wallRole: r, wallThickness: null, wallPreset: null })}
        aria-pressed={active}
      >
        <WallIcon t={Math.max(1.5, t * 14)} />
        <span>{label}</span>
      </button>
    );
  };
  return (
    <div className="build-tab">
      {buildGroup === 'walls' && (
        <>
          <h3 className="lib-h">Walls</h3>
          <div className="build-grid">
            {wallCard('exterior', 'Exterior wall', settings.exteriorThickness)}
            {wallCard('interior', 'Interior wall', settings.defaultWall.thickness)}
            {wallCard('partition', 'Partition', 0.08)}
            <button
              type="button"
              className={`build-card${tool === 'curve' ? ' on' : ''}`}
              onClick={() => set({ tool: 'curve' })}
              aria-pressed={tool === 'curve'}
            >
              <svg viewBox="0 0 40 40" aria-hidden>
                <path d="M5 30 Q20 2 35 30" fill="none" stroke="currentColor" strokeWidth="4" />
              </svg>
              <span>Curved wall</span>
            </button>
            <button
              type="button"
              className={`build-card${tool === 'room' ? ' on' : ''}`}
              onClick={() => set({ tool: 'room' })}
              aria-pressed={tool === 'room'}
              data-testid="build-room"
            >
              <svg viewBox="0 0 40 40" aria-hidden>
                <rect
                  x="6"
                  y="8"
                  width="28"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                />
              </svg>
              <span>Room</span>
            </button>
          </div>
          <WallPresetCards />
        </>
      )}
      {buildGroup === 'doors' && (
        <>
          <h3 className="lib-h">Doors</h3>
          <div className="build-grid">
            {DOOR_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={`build-card${tool === 'opening' && kind === k ? ' on' : ''}`}
                onClick={() => set({ tool: 'opening', openingKind: k })}
                aria-pressed={tool === 'opening' && kind === k}
                data-testid={`build-${k}`}
              >
                {extraOpeningIcon(k) ?? <OpeningIcon kind={k} />}
                <span>{OPENING_PRESETS[k].label}</span>
              </button>
            ))}
          </div>
          <OpeningBuildOptions kinds={DOOR_KINDS} />
        </>
      )}
      {buildGroup === 'windows' && (
        <>
          <h3 className="lib-h">Windows</h3>
          <div className="build-grid">
            {WINDOW_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={`build-card${tool === 'opening' && kind === k ? ' on' : ''}`}
                onClick={() => set({ tool: 'opening', openingKind: k })}
                aria-pressed={tool === 'opening' && kind === k}
              >
                {extraOpeningIcon(k) ?? <OpeningIcon kind={k} />}
                <span>{OPENING_PRESETS[k].label}</span>
              </button>
            ))}
          </div>
          <OpeningBuildOptions kinds={WINDOW_KINDS} />
        </>
      )}
    </div>
  );
}

// ───────────── Furniture tab ─────────────


/** Sidebar filter: a room or item category, all, recent, groups, or a collection (`col:<id>`). */
type CatFilter = FurnitureCategoryId | 'all' | 'recent' | 'groups' | `col:${string}`;

const isCollectionFilter = (c: CatFilter): c is `col:${string}` => c.startsWith('col:');

const CATEGORY_ICONS: Record<FurnitureCategoryId, typeof Sofa> = {
  'room:living': Sofa,
  'room:bedroom': BedDouble,
  'room:kitchen': CookingPot,
  'room:dining': Utensils,
  'room:bathroom': Bath,
  'room:office': Monitor,
  'room:kids': Baby,
  'room:laundry': WashingMachine,
  'room:outdoor': Sun,
  'item:seating': Armchair,
  'item:beds': Bed,
  'item:tables': Table2,
  'item:storage': Archive,
  'item:appliances': Refrigerator,
  'item:plumbing': ShowerHead,
  'item:lighting': Lamp,
  'item:electronics': Tv,
  'item:textiles': Blinds,
  'item:decor': Frame,
  'item:plants': Sprout,
  'item:structure': Columns2,
  'item:hobbies': Dumbbell,
  'item:pets': PawPrint,
  'item:people': User,
  'item:misc': Box,
};

interface Shelf {
  key: string;
  title: string;
  items: AssetDefinition[];
}

/** Versions of an item (`variantOf`: with or without books, tableware…) follow it on the shelf. */
function besideBase(items: AssetDefinition[]): AssetDefinition[] {
  const ids = new Set(items.map((a) => a.id));
  const versions = new Map<string, AssetDefinition[]>();
  for (const a of items)
    if (a.variantOf && ids.has(a.variantOf))
      versions.set(a.variantOf, [...(versions.get(a.variantOf) ?? []), a]);
  if (!versions.size) return items;
  const out: AssetDefinition[] = [];
  for (const a of items) {
    if (a.variantOf && ids.has(a.variantOf)) continue;
    out.push(a, ...(versions.get(a.id) ?? []));
  }
  return out;
}

/** Splits a listing into titled shelves: one shelf per type in All, or per group within a room/item category. */
function shelves(list: AssetDefinition[], cat: CatFilter): Shelf[] {
  if (cat === 'recent') return [{ key: cat, title: '', items: list }];
  const byKey = new Map<string, Shelf & { rank: number }>();
  const add = (key: string, title: string, rank: number, a: AssetDefinition) => {
    const shelf = byKey.get(key) ?? { key, title, rank, items: [] };
    shelf.items.push(a);
    byKey.set(key, shelf);
  };
  for (const a of list) {
    if (cat === 'all') {
      // Whole catalogue: one shelf per type.
      add(a.type, ASSET_TYPE_LABELS[a.type], ASSET_TYPE_ORDER.indexOf(a.type), a);
    } else if (isFurnitureCategoryId(cat)) {
      add(`${a.type}|${a.group}`, a.group, categoryShelfRank(cat, a.type, a.group), a);
    } else {
      add(`${a.type}|${a.group}`, a.group, groupRank(a.type, a.group), a);
    }
  }
  return [...byKey.values()]
    .sort((x, y) => x.rank - y.rank || x.title.localeCompare(y.title))
    .map(({ key, title, items }) => ({ key, title, items: besideBase(items) }));
}

function FurnitureTab({ isMobile }: { isMobile: boolean }) {
  // Only the parts of the project the library shows: moving furniture must not re-render every card.
  const customAssets = useProjectStore((s) => s.project!.customAssets);
  const collections = useProjectStore((s) => s.project!.collections);
  const project = useMemo(() => ({ customAssets }), [customAssets]);
  const favourites = usePrefsStore((s) => s.favouriteAssets);
  const recents = usePrefsStore((s) => s.recentAssets);
  const savedGroups = usePrefsStore((s) => s.savedGroups);
  const packs = usePackVersion();
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [cat, setCat] = useState<CatFilter>('all');
  const railCollapsed = useRailCollapsed();
  const resultsRef = useRef<HTMLDivElement>(null);

  const chooseCat = (next: CatFilter) => {
    setCat(next);
    resultsRef.current?.scrollTo({ top: 0 });
  };

  // Saved groups still called "Group 3" get names from their contents once their items resolve.
  useEffect(() => {
    if (cat === 'groups') renameGenericSavedGroups();
  }, [cat, packs, savedGroups]);
  // A new collection (or the Collections menu) asks to show one.
  const showCol = useEditorStore((s) => s.libraryCollection);
  useEffect(() => {
    if (!showCol) return;
    setQuery('');
    setFavOnly(false);
    setCat(`col:${showCol.id}`);
    resultsRef.current?.scrollTo({ top: 0 });
  }, [showCol]);
  const collection = isCollectionFilter(cat) ? collections.find((c) => `col:${c.id}` === cat) : undefined;
  // A deleted collection (or one removed by undo) falls back to everything.
  useEffect(() => {
    if (isCollectionFilter(cat) && !collection) setCat('all');
  }, [cat, collection]);
  // Inspector → Show in library: open the item's primary category, clear filters, then
  // scroll its card into view and flash it.
  const reveal = useEditorStore((s) => s.libraryReveal);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  useEffect(() => {
    if (!reveal) return;
    const asset = getAsset(project, reveal.assetId);
    if (!asset) return;
    const targetCat = primaryItemCategoryOf(asset);
    setQuery('');
    setFavOnly(false);
    setCat(targetCat);
    // The shelf re-renders after the filter change: retry until the card exists.
    let tries = 0;
    const t = window.setInterval(() => {
      const el = document
        .querySelector<HTMLElement>(`[data-testid="asset-${CSS.escape(reveal.assetId)}"]`)
        ?.closest<HTMLElement>('.asset-card');
      if (!el && ++tries < 25) return;
      window.clearInterval(t);
      document
        .querySelector<HTMLElement>(`[data-testid="lib-cat-${CSS.escape(targetCat)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
      if (!el) return;
      el.scrollIntoView({ block: 'center' });
      setRevealedId(reveal.assetId);
    }, 80);
    const off = window.setTimeout(() => setRevealedId(null), 2600);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);
  // One hover/focus info card for the whole listing (desktop only: touch has no hover).
  const info = useMemo(() => (isMobile ? null : new InfoCardControl()), [isMobile]);
  const custom = useMemo(
    () => Object.values(customAssets).map(customAssetDefinition),
    [customAssets],
  );
  const all = useMemo(
    () => [...ASSET_CATALOG, ...custom],
    // Pack items are added to the catalogue in place, so re-read it when packs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [custom, packs],
  );
  const q = query.trim().toLowerCase();
  // Groups: the user's saved groups, then the ready-made ones by shelf, as ordinary item cards —
  // under the Groups entry of the sidebar, and among the results when searching everything.
  const groupMatch = useMemo(
    () => (a: { name: string; tags: string[]; description?: string; group: string }) =>
      !q || `${a.name} ${a.tags.join(' ')} ${a.description ?? ''} ${a.group}`.toLowerCase().includes(q),
    [q],
  );
  // Pack items resolve in place when `packs` changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allSavedGroups = useMemo(() => savedGroupAssets(savedGroups), [savedGroups, packs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allReadyGroups = useMemo(() => savedGroupAssets(readyGroups()), [packs]);
  const matchedSavedGroups = useMemo(() => allSavedGroups.filter(groupMatch), [allSavedGroups, groupMatch]);
  const matchedReadyGroups = useMemo(() => allReadyGroups.filter(groupMatch), [allReadyGroups, groupMatch]);
  const showGroups = cat === 'groups' || (cat === 'all' && !!q && !favOnly);
  const groupItems = showGroups ? matchedSavedGroups : [];
  const readyItems = showGroups ? matchedReadyGroups : [];

  // Items matching the search query and favourites toggle (before category selection).
  const baseList = useMemo(
    () =>
      all.filter((a) => {
        if (q) {
          const hay = `${a.name} ${a.tags.join(' ')} ${ASSET_CATEGORY_LABELS[a.category]} ${ASSET_TYPE_LABELS[a.type]} ${a.group} ${a.pack?.name ?? ''} ${furnitureCategorySearchText(a)} ${a.plant ? plantSearchText(a.plant) : ''} ${servicesSearchText(a.services)}`;
          if (!hay.toLowerCase().includes(q)) return false;
        }
        if (favOnly && !favourites.includes(a.id)) return false;
        return true;
      }),
    [all, q, favOnly, favourites],
  );

  // Live item counts per category so the left rail shows exact counts (and live search counts).
  const catCounts = useMemo(() => {
    const counts = new Map<FurnitureCategoryId, number>();
    for (const a of baseList) {
      for (const id of furnitureCategoriesOf(a).all) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [baseList]);

  const recentSet = useMemo(() => new Set(recents), [recents]);
  const recentCount = useMemo(
    () => baseList.reduce((n, a) => n + (recentSet.has(a.id) ? 1 : 0), 0),
    [baseList, recentSet],
  );
  const totalGroupCount = matchedSavedGroups.length + matchedReadyGroups.length;

  // A collection: its items and groups in order (search narrows it); items whose pack is gone are counted.
  const collectionAll = collection ? collection.items.map((id) => getAsset(project, id)) : [];
  const collectionMissing = collectionAll.filter((a) => !a).length;
  const collectionItems = (collectionAll.filter(Boolean) as AssetDefinition[]).filter((a) => groupMatch({ ...a, description: a.description }) && (!favOnly || favourites.includes(a.id)));

  const list = useMemo(() => {
    if (cat === 'all') return baseList;
    if (cat === 'recent') {
      return baseList
        .filter((a) => recentSet.has(a.id))
        .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id));
    }
    if (cat === 'groups' || isCollectionFilter(cat)) return [];
    return baseList.filter((a) => furnitureCategoriesOf(a).all.has(cat));
  }, [baseList, cat, recentSet, recents]);

  const groupShelves = [
    ...(groupItems.length ? [{ key: 'saved-groups', title: 'Your groups', items: groupItems }] : []),
    ...READY_GROUP_SHELVES.map((title) => ({
      key: `ready-${title}`,
      title,
      items: readyItems.filter((a) => a.group === title),
    })).filter((sh) => sh.items.length),
  ];
  const groups = collection
    ? collectionItems.length
      ? [{ key: `col-${collection.id}`, title: '', items: collectionItems }]
      : []
    : cat === 'groups'
      ? groupShelves
      : [
          ...shelves(list, cat),
          // Searching everything also finds groups.
          ...(showGroups && (groupItems.length || readyItems.length) ? [{ key: 'search-groups', title: 'Groups', items: [...groupItems, ...readyItems] }] : []),
        ];

  const renderCatBtn = (
    value: CatFilter,
    label: string,
    Icon: typeof Sofa,
    count: number,
    tooltip?: string,
  ) => {
    const active = cat === value;
    const empty = !!(q || favOnly) && count === 0 && !active;
    return (
      <CategoryButton
        key={value}
        active={active}
        empty={empty}
        onClick={() => chooseCat(value)}
        icon={Icon}
        label={label}
        count={count}
        tooltip={tooltip}
        testId={`lib-cat-${value}`}
      />
    );
  };

  return (
    <div className="furniture-tab">
      <div className="lib-filters">
        <div className="lib-browse-row">
          <div className="search-box">
            <Search size={13} aria-hidden />
            <input
              className="input"
              placeholder={`Search ${all.length} items…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={searchKeyDown(query, setQuery)}
              aria-label="Search library"
              data-testid="library-search"
            />
            <SearchClear query={query} onClear={() => setQuery('')} testId="library-search-clear" />
          </div>
          <IconButton
            label="Favourites"
            active={favOnly}
            onClick={() => setFavOnly(!favOnly)}
            className="fav-filter-btn"
            data-testid="filter-favourites"
          >
            <Star size={16} />
          </IconButton>
          <IconButton
            label="Collections"
            active={!!collection}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              openContextMenu(r.left, r.bottom + 4, [
                ...collections.map((c) => ({ label: `${c.name} (${c.items.length})`, checked: `col:${c.id}` === cat, run: () => chooseCat(`col:${c.id}`) })),
                ...(collections.length ? [{ separator: true, label: '' }] : []),
                { label: 'New collection…', run: () => newCollection() },
              ]);
            }}
            className="collections-btn"
            data-testid="library-collections"
          >
            <FolderHeart size={16} />
          </IconButton>
        </div>
      </div>

      <div className={`furniture-split${railCollapsed ? ' rail-collapsed' : ''}`}>
        <CategoryRail label="Furniture categories" testId="library-categories">
          <div className="lib-cat-group">
            {renderCatBtn('all', 'All items', LayoutGrid, baseList.length, 'All items · Tất cả')}
            {renderCatBtn('recent', 'Recent', Clock, recentCount, 'Recently placed · Gần đây')}
            {renderCatBtn('groups', 'Groups', Component, totalGroupCount, 'Room & furniture groups · Nhóm mẫu & đã lưu')}
          </div>

          {collections.length > 0 && (
            <div className="lib-cat-group">
              <CategoryHeading>Collections</CategoryHeading>
              {collections.map((c) =>
                renderCatBtn(`col:${c.id}`, c.name, Folder, c.items.length, `${c.name} (${c.items.length})`),
              )}
            </div>
          )}

          <div className="lib-cat-group" data-testid="library-cat-rooms">
            <CategoryHeading>By room</CategoryHeading>
            {ROOM_CATEGORIES.map((c) =>
              renderCatBtn(c.id, c.label, CATEGORY_ICONS[c.id], catCounts.get(c.id) ?? 0, `${c.label} · ${c.vn}`),
            )}
          </div>

          <div className="lib-cat-group" data-testid="library-cat-items">
            <CategoryHeading>By item</CategoryHeading>
            {ITEM_CATEGORIES.map((c) =>
              renderCatBtn(c.id, c.label, CATEGORY_ICONS[c.id], catCounts.get(c.id) ?? 0, `${c.label} · ${c.vn}`),
            )}
          </div>
        </CategoryRail>

        <div className="furniture-results" ref={resultsRef}>
          {collection && (
            <div className="collection-head" data-testid="collection-head">
              <div className="collection-head-text">
                <strong>{collection.name}</strong>
                <span className="shelf-count">{collection.items.length}</span>
                {collection.description && <p className="field-hint">{collection.description}</p>}
              </div>
              <IconButton label="Edit collection" onClick={() => editCollection(collection.id)} data-testid="collection-edit">
                <Pencil size={14} />
              </IconButton>
              <IconButton label="Delete collection" onClick={() => void removeCollection(collection.id)} data-testid="collection-delete">
                <Trash2 size={14} />
              </IconButton>
            </div>
          )}

          <div className="asset-shelves" data-testid="asset-grid">
            {groups.map((g) => (
              <section key={g.key} className="asset-shelf" aria-label={g.title || undefined}>
                {g.title && (
                  <h3 className="lib-h shelf-h">
                    {g.title} <span className="shelf-count">{g.items.length}</span>
                  </h3>
                )}
                <div className="asset-grid">
                  {g.items.map((a) => (
                    <AssetCard key={a.id} asset={a} info={info} revealed={a.id === revealedId} />
                  ))}
                </div>
              </section>
            ))}
            {collection && collectionItems.length === 0 && (
              <p className="field-hint pad">
                {collection.items.length
                  ? 'Nothing in this collection matches your search.'
                  : 'Right-click any item or group in the library and choose “Add to” this collection.'}
              </p>
            )}
            {collection && collectionMissing > 0 && (
              <p className="field-hint pad">
                {collectionMissing} item{collectionMissing > 1 ? 's are' : ' is'} not available here (their content pack is not installed).
              </p>
            )}
            {cat === 'groups' && groupItems.length === 0 && readyItems.length === 0 && (
              <p className="field-hint pad">No groups match your search.</p>
            )}
            {cat === 'groups' && !q && savedGroups.length === 0 && (
              <p className="field-hint pad">
                Your own groups: select placed items, right-click and choose “Save to library as a group”. They
                appear here in every project.
              </p>
            )}
            {list.length === 0 && groups.length === 0 && cat !== 'groups' && !collection && (
              <p className="field-hint pad">
                {favOnly
                  ? 'Star items to collect them here.'
                  : cat === 'recent'
                    ? 'Items you place appear here.'
                    : 'No items match your search.'}
              </p>
            )}
          </div>

          {!isMobile && (
            <button
              type="button"
              className="import-model"
              onClick={() => useDialogStore.getState().open('import-model')}
            >
              <Upload size={14} /> Import GLB / glTF model
            </button>
          )}
        </div>
      </div>

      {info && <AssetInfoCard control={info} />}
    </div>
  );
}

export function AssetPlanThumb({ asset }: { asset: AssetDefinition }) {
  const custom = useProjectStore((s) => s.project?.customAssets[asset.id]);
  const size = asset.defaultSize;
  const plan = assetPlan(asset, size, custom);
  const m = Math.max(size.w, size.d) * 0.62;
  return (
    <svg viewBox={`${-m} ${-m} ${m * 2} ${m * 2}`} className="asset-plan-thumb" aria-hidden>
      {plan.shapes.map((s, i) => (
        <path key={i} d={polyPath(s.points)} strokeWidth={m * 0.025} />
      ))}
      {plan.strokes.map((st, i) =>
        st.kind === 'line' ? (
          <line key={`s${i}`} x1={st.a[0]} y1={st.a[1]} x2={st.b[0]} y2={st.b[1]} strokeWidth={m * 0.018} />
        ) : st.kind === 'circle' ? (
          <circle key={`s${i}`} cx={st.c[0]} cy={st.c[1]} r={st.r} strokeWidth={m * 0.018} fill="none" />
        ) : (
          <path
            key={`s${i}`}
            d={polyPath(
              st.points.map(([x, y]) => ({ x, y })),
              st.closed ?? false,
            )}
            strokeWidth={m * 0.018}
            fill="none"
          />
        ),
      )}
    </svg>
  );
}

/** Starts the place tool with an asset (as clicking its card does). */
function startPlacing(assetId: string) {
  const ed = useEditorStore.getState();
  ed.set({
    tool: 'place',
    placeAssetId: assetId,
    placeRotation: 0,
    workspace: ed.workspace === 'walk' ? '3d' : ed.workspace,
  });
}

/** Places an asset in the middle of the plan view (as dropping it there would). */
function placeInView(assetId: string) {
  const cam = useEditorStore.getState().planCamera;
  window.dispatchEvent(new CustomEvent('neest:drop-asset', { detail: { assetId, x: cam.cx, y: cam.cy } }));
}

function AssetCard({
  asset,
  info,
  revealed = false,
}: {
  asset: AssetDefinition;
  info: InfoCardControl | null;
  revealed?: boolean;
}) {
  const fav = usePrefsStore((s) => s.favouriteAssets.includes(asset.id));
  const placing = useEditorStore((s) => s.tool === 'place' && s.placeAssetId === asset.id);
  const units = useProjectStore((s) => s.project!.settings.units);
  // Items with model variants show the chosen model (toggle in the card corner).
  const { chosen: model } = useChosenModel(asset);
  const shown = useMemo(() => withModel(asset, model?.id), [asset, model]);
  const [thumbRef, thumb] = useAssetThumbnail<HTMLDivElement>(shown);
  const size = asset.defaultSize;
  const dims = `${formatLength(size.w, units, 0, { suffix: false })} × ${formatLength(size.d, units, 0)}`;
  let preview: ReactNode = <AssetPlanThumb asset={shown} />;
  if (thumb) preview = <img src={thumb} alt="" draggable={false} />;
  useEffect(() => {
    const el = thumbRef.current;
    return () => {
      if (el) info?.release(el);
    };
  }, [info, thumbRef]);
  return (
    <div
      ref={thumbRef}
      className={`asset-card${placing ? ' on' : ''}${revealed ? ' revealed' : ''}`}
      onPointerEnter={
        info ? (e) => e.pointerType !== 'touch' && info.enter(asset, e.currentTarget) : undefined
      }
      onPointerLeave={info ? () => info.leave() : undefined}
      onPointerDown={info ? () => info.dismiss() : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        info?.dismiss();
        const prefs = usePrefsStore.getState();
        const isFav = prefs.favouriteAssets.includes(asset.id);
        const groupId = asset.id.startsWith(SAVED_GROUP_PREFIX)
          ? asset.id.slice(SAVED_GROUP_PREFIX.length)
          : null;
        const ready = groupId ? readyGroupById(groupId) : undefined;
        openContextMenu(e.clientX, e.clientY, [
          { label: 'Place…', run: () => startPlacing(asset.id) },
          { label: 'Place in view', run: () => placeInView(asset.id) },
          // From search results, Recent or a collection: jump to the item's own shelf.
          ...(groupId
            ? []
            : [
                {
                  label: `Show in ${FURNITURE_CATEGORY_BY_ID.get(primaryItemCategoryOf(asset))?.label ?? ASSET_TYPE_LABELS[asset.type]} › ${asset.group}`,
                  run: () => useEditorStore.getState().set({ libraryReveal: { assetId: asset.id, nonce: Date.now() } }),
                },
              ]),
          ...(ready
            ? [{ label: 'Copy to my groups', run: () => copyReadyGroup(ready) }]
            : groupId
              ? [
                  { label: 'Name & description…', run: () => editSavedGroupDetails(groupId) },
                  { separator: true, label: '' },
                  { label: 'Delete from library', danger: true, run: () => void removeSavedGroup(groupId) },
                ]
              : [
                  {
                    label: isFav ? 'Remove from favourites' : 'Add to favourites',
                    run: () => prefs.toggleFavouriteAsset(asset.id),
                  },
                ]),
          ...collectionMenuItems(asset.id, asset.name),
        ]);
      }}
    >
      <button
        type="button"
        className="asset-main"
        draggable
        onDragStart={(e) => {
          info?.dismiss();
          e.dataTransfer.setData('application/x-neest-asset', asset.id);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onFocus={(e) => {
          if (!info) return;
          let keyboard = false;
          try {
            keyboard = e.currentTarget.matches(':focus-visible');
          } catch {
            // Selector unsupported: no card on focus.
          }
          const card = e.currentTarget.closest<HTMLElement>('.asset-card');
          if (keyboard && card) info.enter(asset, card);
        }}
        onBlur={info ? () => info.leave() : undefined}
        onClick={() => {
          info?.dismiss();
          startPlacing(asset.id);
        }}
        aria-pressed={placing}
        // Desktop: name, source and the place/drag hint are in the info card instead.
        title={
          info
            ? undefined
            : `${asset.name}${asset.pack ? ` (from the ${asset.pack.name} pack)` : ''} — click to place, or drag onto the plan`
        }
        data-testid={`asset-${asset.id}`}
      >
        <span className="asset-thumb">
          {preview}
          {asset.brand && (
            <span className="brand-tag" title={`${asset.brand.name} ${asset.brand.model}`}>
              {asset.brand.name}
            </span>
          )}
          {asset.pack && !info && (
            <span className="pack-badge" title={`From the ${asset.pack.name} pack`}>
              {asset.pack.name}
            </span>
          )}
        </span>
        <span className="asset-name">{asset.name}</span>
        <span className="asset-dims num">{dims}</span>
      </button>
      <CardModelButton asset={asset} />
      <button
        type="button"
        className={`fav-btn${fav ? ' on' : ''}`}
        aria-label={fav ? `Remove ${asset.name} from favourites` : `Add ${asset.name} to favourites`}
        aria-pressed={fav}
        onClick={() => usePrefsStore.getState().toggleFavouriteAsset(asset.id)}
      >
        <Star size={12} />
      </button>
    </div>
  );
}
