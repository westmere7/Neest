import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import type { LengthUnit } from '@/domain/model/schema';
import { formatLength } from '@/domain/model/units';
import { ASSET_CATEGORY_LABELS } from '@/data/assets/catalog';
import type { AssetDefinition, Size3 } from '@/data/assets/types';
import { usePackVersion } from '@/packs/events';
import { useProjectStore } from '@/state/projectStore';
import type { PreviewHandle } from '@/features/scene-3d/objectPreview';
import { AssetPlanThumb } from './LibraryPanel';
import { useAssetThumbnail } from './thumbnails';

/**
 * Library hover card: a bigger (live 3D) preview, size, source, description and brand details of
 * the furniture card under the pointer, beside the library panel.
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
      <InfoPreview asset={shown.asset} />
      <InfoBody asset={shown.asset} />
    </div>,
    document.body,
  );
}

// ───────────── Contents ─────────────

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type PreviewState = 'loading' | 'ok' | 'fallback';

/**
 * The shared live 3D preview renderer (the Inspector's, borrowed while the card is open) turning
 * the item at its default size. The cached library thumbnail shows until the model is ready, and
 * stays when 3D isn't available.
 */
function InfoPreview({ asset }: { asset: AssetDefinition }) {
  const project = useProjectStore((s) => s.project!);
  const packs = usePackVersion();
  const [hostRef, thumb] = useAssetThumbnail<HTMLDivElement>(asset);
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
        h = m.attachPreview(host, { reducedMotion: prefersReducedMotion(), onFail: () => setState('fallback') });
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
  }, [hostRef]);

  const materials = project.materials;
  useEffect(() => {
    if (!handle) return;
    let alive = true;
    setState('loading');
    void handle.showAsset(asset, latest.current).then((r) => {
      if (alive && r !== 'stale') setState(r);
    });
    return () => {
      alive = false;
    };
  }, [handle, asset, materials, packs]);

  return (
    <div ref={hostRef} className={`aic-preview is-${state}`} aria-hidden>
      {state !== 'ok' && (thumb ? <img src={thumb} alt="" draggable={false} /> : <AssetPlanThumb asset={asset} />)}
    </div>
  );
}

/** A length to the millimetre (or quarter inch) without trailing zeros: 0.85 m, 84.5 cm, 2' 9.25". */
function len(m: number, units: LengthUnit, suffix: boolean): string {
  if (units === 'ft') return formatLength(m, units, 2);
  const text = formatLength(m, units, 3, { suffix: false }).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
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

function InfoBody({ asset }: { asset: AssetDefinition }) {
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
      <dl className="aic-rows">
        <Row label="Size">
          <span className="num">{sizeText(asset.defaultSize, units)}</span>
          {resize && <span className="aic-sub num">{resize}</span>}
        </Row>
        <Row label="Source">
          {src.name}
          <span className="aic-sub">{src.license}</span>
        </Row>
      </dl>
      <p className="aic-hint">Click to place, or drag onto the plan.</p>
    </div>
  );
}
