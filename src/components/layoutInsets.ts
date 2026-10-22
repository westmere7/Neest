/** Pixels of a canvas covered by Neest's floating panels, per side. */
export interface Insets {
  l: number;
  r: number;
  t: number;
  b: number;
}

/**
 * Measures how much of `host` is covered by the floating chrome (top bar,
 * tool rail, library, 3D view panel, inspector + finish and layers panels, status/mobile bar) so views
 * can be framed inside the area the user can actually see.
 */
export function floatingInsets(host: DOMRect): Insets {
  const insets: Insets = { l: 0, r: 0, t: 0, b: 0 };
  if (typeof document === 'undefined' || document.querySelector('.editor.chrome-hidden')) return insets;
  const rect = (el: Element) => el.getBoundingClientRect();
  const midX = host.left + host.width / 2;
  for (const el of document.querySelectorAll('.tool-rail, .library:not(.sheet), .view-panel:not(.mobile):not(.collapsed)')) {
    const r = rect(el);
    if (r.width && r.left < midX) insets.l = Math.max(insets.l, r.right - host.left);
  }
  for (const el of document.querySelectorAll('.inspector:not(.sheet), .material-panel, .layers-panel')) {
    const r = rect(el);
    if (r.width && r.left > midX) insets.r = Math.max(insets.r, host.right - r.left);
  }
  const top = document.querySelector('.topbar');
  if (top) insets.t = Math.max(0, rect(top).bottom - host.top);
  const bottom = document.querySelector('.status-bar') ?? document.querySelector('.mobile-bar');
  if (bottom) insets.b = Math.max(0, host.bottom - rect(bottom).top);
  // Keep a usable free area: when the panels leave less than this, shrink both
  // sides proportionally so the framing stays centred between them.
  const minFree = Math.min(260, host.width * 0.4);
  const sideTotal = insets.l + insets.r;
  if (sideTotal > 0 && host.width - sideTotal < minFree) {
    const k = Math.max(0, host.width - minFree) / sideTotal;
    insets.l *= k;
    insets.r *= k;
  }
  const minFreeH = Math.min(200, host.height * 0.4);
  const vertTotal = insets.t + insets.b;
  if (vertTotal > 0 && host.height - vertTotal < minFreeH) {
    const k = Math.max(0, host.height - minFreeH) / vertTotal;
    insets.t *= k;
    insets.b *= k;
  }
  return insets;
}
