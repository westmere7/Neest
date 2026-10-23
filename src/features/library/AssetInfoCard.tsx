import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Maximize2 } from 'lucide-react';
import type { LengthUnit, PlacedObject } from '@/domain/model/schema';
import { formatLength } from '@/domain/model/units';
import { ASSET_CATEGORY_LABELS } from '@/data/assets/catalog';
import type { AssetDefinition, AssetPrice, Size3 } from '@/data/assets/types';
import { formatVnd } from '@/data/assets/price';
import { usePackVersion } from '@/packs/events';
import { useProjectStore } from '@/state/projectStore';
import { getAsset } from '@/data/assets/registry';
import { Dialog } from '@/components/Overlays';
import { Button } from '@/components/ui';
import type { PreviewHandle } from '@/features/scene-3d/objectPreview';
import { AssetPlanThumb } from './LibraryPanel';
import { PlantCare } from './PlantCare';
import { VariantSwatches } from './VariantSwatches';
import { ModelPicker, chooseModel, useChosenModel } from './ModelPicker';
import { withModel } from '@/data/assets/models';
import { variantDefs, variantsFor } from './variantChoice';
import { useEditorStore } from '@/state/editorStore';
import { useDialogStore, usePrefsStore } from '@/state/uiStores';
import type { AssetVariant } from '@/data/assets/variants';
import { useAssetThumbnail } from './thumbnails';
import { ServiceNeeds } from '@/features/services/ServiceBadges';

/**
 * Library hover card: a bigger (live 3D) preview, colour variant swatches, size, source, description,
 * brand details and plant care guide of the furniture card under the pointer, beside the library panel.
 * Picking a swatch shows that variant in the preview and places new items in it.
 *
 * It opens after a short hover with a mouse or pen (never on touch), or when a card gets keyboard
 * focus, and closes on leave, blur, scroll, Esc, click or drag. Moving to the next card while one
 * is open switches quickly. The pointer may cross into the card (it sits beside the panel, so it
 * never covers the cards) to follow its "Specs source" link; when the viewport is too narrow and it
 * would overlap the panel, it ignores the pointer instead.
 */

export const INFO_CARD_ID = 'asset-info-card';
const SHOW_MS = 350;
const SWITCH_MS = 120;
const HIDE_GRACE_MS = 220;
const WARM_MS = 500;
const GAP = 8;
const MARGIN = 8;

interface Shown {
  asset: AssetDefinition;
  /** The `.asset-card` it is about (position) and its main button (aria-describedby). */
  card: HTMLElement;
  button: HTMLElement;
}

/** Hover/focus state of the library's one info card. Plain object so the cards don't re-render. */
export class InfoCardControl {
  private shown: Shown | null = null;
  private timer = 0;
  private hiddenAt = -Infinity;
  private readonly subs = new Set<() => void>();

  readonly subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  readonly get = () => this.shown;

  private set(next: Shown | null) {
    this.shown?.button.removeAttribute('aria-describedby');
    if (!next && this.shown) this.hiddenAt = performance.now();
    this.shown = next;
    next?.button.setAttribute('aria-describedby', INFO_CARD_ID);
    this.subs.forEach((fn) => fn());
  }

  /** Pointer entered (or keyboard focus reached) a card: open after a delay, or switch quickly. */
  enter(asset: AssetDefinition, card: HTMLElement) {
    window.clearTimeout(this.timer);
    if (this.shown?.card === card) return;
    const warm = this.shown !== null || performance.now() - this.hiddenAt < WARM_MS;
    this.timer = window.setTimeout(
      () => {
        if (!card.isConnected) return;
        const button = card.querySelector<HTMLElement>('.asset-main') ?? card;
        this.set({ asset, card, button });
      },
      warm ? SWITCH_MS : SHOW_MS,
    );
  }

  /** Pointer left a card or the info card (or focus left): close unless it comes right back. */
  leave() {
    window.clearTimeout(this.timer);
    if (this.shown) this.timer = window.setTimeout(() => this.set(null), HIDE_GRACE_MS);
  }

  /** Pointer is over the info card itself: keep it open. */
  hold() {
    window.clearTimeout(this.timer);
  }

  /** Click, drag, Esc or scroll: close now, and the next hover waits the full delay again. */
  dismiss() {
    window.clearTimeout(this.timer);
    if (this.shown) this.set(null);
    this.hiddenAt = -Infinity;
  }

  /** A card is going away (filtered out, tab switched). */
  release(card: HTMLElement) {
    if (this.shown?.card === card) this.dismiss();
  }
}

/** Renders the info card (in a portal) for the control's current card. */
export function AssetInfoCard({ control }: { control: InfoCardControl }) {
  const shown = useSyncExternalStore(control.subscribe, control.get, () => null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') control.dismiss();
    };
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && ref.current?.contains(e.target)) return;
      control.dismiss();
    };
    const close = () => control.dismiss();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      control.dismiss();
    };
  }, [control]);

  // Beside the library panel, level with the hovered card, kept inside the panel's height.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shown) return;
    const place = () => {
      const r = shown.card.getBoundingClientRect();
      const panel = shown.card.closest('.library')?.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = el.offsetWidth;
      let left = (panel?.right ?? r.right) + GAP;
      const fits = left + w <= vw - MARGIN;
      if (!fits) left = Math.max(MARGIN, vw - w - MARGIN);
      const minTop = Math.max(MARGIN, panel?.top ?? MARGIN);
      const maxBottom = Math.min(vh - MARGIN, panel?.bottom ?? vh - MARGIN);
      el.style.maxHeight = `${Math.max(120, maxBottom - minTop)}px`;
      const top = Math.max(minTop, Math.min(r.top, maxBottom - el.offsetHeight));
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      // Over the panel (narrow window): let clicks and drags through to the cards.
      el.classList.toggle('passive', !fits);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown]);

  if (!shown || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      id={INFO_CARD_ID}
      role="tooltip"
      className="asset-info-card"
      data-testid="asset-info-card"
      onPointerEnter={() => control.hold()}
      onPointerLeave={() => control.leave()}
    >
      <InfoPreview
        asset={shown.asset}
        onExpand={() => {
          const id = shown.asset.id;
          control.dismiss();
          useDialogStore.getState().open('asset-viewer', { assetId: id });
        }}
      />
      <InfoBody asset={shown.asset} />
    </div>,
    document.body,
  );
}

// ───────────── Contents ─────────────

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type PreviewState = 'loading' | 'ok' | 'fallback';

/**
 * The shared live 3D preview renderer (the Inspector's, borrowed while the card is open) turning
 * the item at its default size. The cached library thumbnail shows until the model is ready, and
 * stays when 3D isn't available.
 */
/** The variant chosen for an asset in the library (re-renders when the choice or the saved variants change). */
function useChosenVariant(asset: AssetDefinition): {
  variants: AssetVariant[];
  chosen: AssetVariant | undefined;
} {
  const choice = useEditorStore((s) => s.variantChoice[asset.id]);
  const saved = usePrefsStore((s) => s.assetVariants[asset.id]);
  usePackVersion();
  const variants = variantsFor(asset, saved);
  return { variants, chosen: variants.find((v) => v.id === choice) };
}

/**
 * `viewer`: the large free-view version (scroll to zoom, double-click to reset); otherwise the hover
 * card preview, with an expand button (`onExpand`) once the model shows.
 */
function InfoPreview({
  asset,
  viewer = false,
  onExpand,
  object,
}: {
  asset: AssetDefinition;
  viewer?: boolean;
  onExpand?: () => void;
  object?: PlacedObject;
}) {
  const project = useProjectStore((s) => s.project!);
  const packs = usePackVersion();
  const { chosen } = useChosenVariant(asset);
  const variantKey = chosen ? chosen.id : '';
  const { chosen: model } = useChosenModel(asset);
  const shown = useMemo(() => withModel(asset, model?.id), [asset, model]);
  const [hostRef, thumb] = useAssetThumbnail<HTMLDivElement>(shown);
  const [handle, setHandle] = useState<PreviewHandle | null>(null);
  const [state, setState] = useState<PreviewState>('loading');
  const latest = useRef(project);
  latest.current = project;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let h: PreviewHandle | null = null;
    import('@/features/scene-3d/objectPreview')
      .then((m) => {
        if (cancelled) return;
        h = m.attachPreview(host, {
          reducedMotion: prefersReducedMotion(),
          onFail: () => setState('fallback'),
          zoom: viewer,
        });
        if (h) setHandle(h);
        else setState('fallback');
      })
      .catch(() => {
        if (!cancelled) setState('fallback');
      });
    return () => {
      cancelled = true;
      h?.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostRef]);

  const materials = project.materials;
  useEffect(() => {
    if (!handle) return;
    let alive = true;
    setState('loading');
    // A saved variant may carry project-only materials: resolve them through a project copy.
    const defs = chosen ? variantDefs(asset, chosen.id) : undefined;
    const p = defs
      ? { ...latest.current, materials: { ...defs, ...latest.current.materials } }
      : latest.current;
    // A placed item shows as placed (its size, finishes and model); a library item in the library choice.
    void (
      object ? handle.show(object, latest.current) : handle.showAsset(asset, p, chosen?.materials ?? {}, model?.id)
    ).then((r) => {
      if (alive && r !== 'stale') setState(r);
    });
    return () => {
      alive = false;
    };
    // The chosen variant is identified by its key; its object is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, shown, materials, packs, variantKey, object]);

  return (
    <div className={`aic-preview-wrap${viewer ? ' viewer' : ''}`}>
      <div ref={hostRef} className={`aic-preview is-${state}${viewer ? ' viewer' : ''}`} aria-hidden>
        {state !== 'ok' &&
          (thumb ? <img src={thumb} alt="" draggable={false} /> : <AssetPlanThumb asset={shown} />)}
      </div>
      {onExpand && state === 'ok' && (
        <button
          type="button"
          className="aic-expand"
          aria-label="Open a large view"
          title="Open a large view to look around it"
          onClick={onExpand}
          data-testid="aic-expand"
        >
          <Maximize2 size={13} aria-hidden />
        </button>
      )}
      {viewer && <p className="aic-view-hint">Drag to turn · scroll to zoom · double-click to reset</p>}
    </div>
  );
}

/**
 * Large viewer of a library item (opened from the hover card's expand button): the live model to
 * turn and zoom freely, beside everything the card shows, with its model and colour pickers and a
 * Place button.
 */
export function AssetViewerDialog({
  assetId,
  objectId,
  onClose,
}: {
  assetId: string;
  objectId?: string;
  onClose: () => void;
}) {
  const project = useProjectStore((s) => s.project!);
  usePackVersion();
  const obj = objectId ? project.objects[objectId] : undefined;
  const asset = getAsset(project, obj?.assetId ?? assetId);
  if (!asset) return null;
  return (
    <Dialog
      title={obj?.name ?? asset.name}
      onClose={onClose}
      wide="xl"
      testId="asset-viewer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!obj && (
            <Button
              variant="primary"
              data-testid="asset-viewer-place"
              onClick={() => {
                const ed = useEditorStore.getState();
                ed.set({
                  tool: 'place',
                  placeAssetId: asset.id,
                  placeRotation: 0,
                  workspace: ed.workspace === 'walk' ? '3d' : ed.workspace,
                });
                onClose();
              }}
            >
              Place
            </Button>
          )}
        </>
      }
    >
      <div className="asset-viewer">
        <InfoPreview asset={asset} viewer object={obj} />
        <div className="asset-viewer-info">
          <InfoBody
            asset={asset}
            hint={null}
            pickers={!obj}
            size={obj ? { w: obj.width, d: obj.depth, h: obj.height } : undefined}
          />
        </div>
      </div>
    </Dialog>
  );
}

/** A length to the millimetre (or quarter inch) without trailing zeros: 0.85 m, 84.5 cm, 2' 9.25". */
function len(m: number, units: LengthUnit, suffix: boolean): string {
  if (units === 'ft') return formatLength(m, units, 2);
  const text = formatLength(m, units, 3, { suffix: false })
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
  if (!suffix) return text;
  return units === 'in' ? `${text}"` : `${text} ${units}`;
}

function sizeText(s: Size3, units: LengthUnit): string {
  return `${len(s.w, units, false)} × ${len(s.d, units, false)} × ${len(s.h, units, true)}`;
}

/** "from A to B" when the item can be resized to anything other than its default. */
function resizeText(a: AssetDefinition, units: LengthUnit): string | null {
  if (!a.minSize || !a.maxSize) return null;
  const pick = (lim: Size3): Size3 => ({
    w: a.resizable.w ? lim.w : a.defaultSize.w,
    d: a.resizable.d ? lim.d : a.defaultSize.d,
    h: a.resizable.h ? lim.h : a.defaultSize.h,
  });
  const lo = pick(a.minSize);
  const hi = pick(a.maxSize);
  if (lo.w === hi.w && lo.d === hi.d && lo.h === hi.h) return null;
  return `Resizable from ${sizeText(lo, units)} to ${sizeText(hi, units)}`;
}

function sourceOf(a: AssetDefinition): { name: string; license: string } {
  if (a.pack) {
    const v = a.pack.version ? ` v${a.pack.version}` : '';
    const by = a.pack.author ? ` · ${a.pack.author}` : '';
    return { name: `${a.pack.name} pack${v}${by}`, license: a.source.license };
  }
  if (a.category === 'custom') return { name: `Imported · ${a.source.name}`, license: a.source.license };
  return { name: 'Neest library', license: a.source.license };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** Colour variant swatches; picking one arms the place tool with it (the next item placed uses it). */
function InfoVariants({ asset }: { asset: AssetDefinition }) {
  const { variants, chosen } = useChosenVariant(asset);
  if (variants.length < 2) return null;
  const current = chosen ?? variants[0];
  return (
    <div className="aic-variants">
      <VariantSwatches
        variants={variants}
        selected={current.id}
        onPick={(v) => {
          // Picking a variant also arms the place tool with this item; the card stays open.
          const ed = useEditorStore.getState();
          ed.set({
            variantChoice: { ...ed.variantChoice, [asset.id]: v.id },
            tool: 'place',
            placeAssetId: asset.id,
            placeRotation: 0,
            workspace: ed.workspace === 'walk' ? '3d' : ed.workspace,
          });
        }}
      />
      <div className="vs-caption">{current.name}</div>
    </div>
  );
}

/** What the item costs in Vietnam: a researched listed price for branded models, otherwise a rough estimate. */
function InfoPrice({ price }: { price: AssetPrice }) {
  return (
    <div className="aic-price" data-testid="aic-price">
      <span className="aic-price-value num">{formatVnd(price)}</span>
      <span className="aic-sub">
        {price.estimate ? 'Approx. price in Vietnam' : 'Listed price in Vietnam'}
        {price.source && (
          <>
            {' · '}
            <a className="aic-link" href={price.source} target="_blank" rel="noopener noreferrer">
              Source <ExternalLink size={10} aria-hidden />
            </a>
          </>
        )}
      </span>
    </div>
  );
}

/** Model variant picker (filled, bare…); picking one arms the place tool with it, like a colour. */
function InfoModels({ asset }: { asset: AssetDefinition }) {
  const { models, chosen } = useChosenModel(asset);
  if (!chosen) return null;
  return (
    <div className="aic-models">
      <ModelPicker
        models={models}
        selected={chosen.id}
        onPick={(m) => {
          chooseModel(asset, m.id);
          const ed = useEditorStore.getState();
          ed.set({
            tool: 'place',
            placeAssetId: asset.id,
            placeRotation: 0,
            workspace: ed.workspace === 'walk' ? '3d' : ed.workspace,
          });
        }}
      />
    </div>
  );
}

function InfoBody({
  asset,
  hint = 'Click to place, or drag onto the plan.',
  pickers = true,
  size,
}: {
  asset: AssetDefinition;
  hint?: ReactNode;
  /** Model and colour pickers for new items (off for a placed item, which has its own in the Inspector). */
  pickers?: boolean;
  /** A placed item's own size (default: the item's default size). */
  size?: Size3;
}) {
  const units = useProjectStore((s) => s.project!.settings.units);
  const src = sourceOf(asset);
  const resize = resizeText(asset, units);
  const brand = asset.brand;
  return (
    <div className="aic-body">
      <header className="aic-head">
        <strong className="aic-name">{asset.name}</strong>
        <span className="aic-meta">
          {asset.group} · {ASSET_CATEGORY_LABELS[asset.category]}
        </span>
      </header>
      {pickers && <InfoModels asset={asset} />}
      {pickers && <InfoVariants asset={asset} />}
      {asset.price && <InfoPrice price={asset.price} />}
      <ServiceNeeds services={asset.services} />
      {asset.description && <p className="aic-desc">{asset.description}</p>}
      {brand && (
        <section className="aic-brand" aria-label={`${brand.name} product`}>
          <div className="aic-brand-head">
            <strong>{brand.name}</strong>
            <span className="aic-sep" aria-hidden>
              ·
            </span>
            <span className="aic-model">{brand.model}</span>
          </div>
          {brand.line && <div className="aic-brand-line">{brand.line}</div>}
          {!!brand.specs?.length && (
            <dl className="aic-specs">
              {brand.specs.map(([k, v], i) => (
                <Row key={i} label={k}>
                  {v}
                </Row>
              ))}
            </dl>
          )}
          {brand.url && (
            <a className="aic-link" href={brand.url} target="_blank" rel="noopener noreferrer">
              Specs source <ExternalLink size={11} aria-hidden />
            </a>
          )}
        </section>
      )}
      {asset.plant && <PlantCare plant={asset.plant} units={units} className="aic-plant" />}
      <dl className="aic-rows">
        <Row label="Size">
          <span className="num">{sizeText(size ?? asset.defaultSize, units)}</span>
          {resize && !size && <span className="aic-sub num">{resize}</span>}
        </Row>
        <Row label="Source">
          {src.name}
          <span className="aic-sub">{src.license}</span>
        </Row>
      </dl>
      {hint && <p className="aic-hint">{hint}</p>}
    </div>
  );
}
