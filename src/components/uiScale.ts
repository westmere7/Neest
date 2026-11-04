/**
 * The interface scale: Neest's chrome (bars, rails, panels, dialogs, menus, tooltips, toasts, the
 * home page) is drawn at this size with CSS `zoom` (rule in components.css, value in `--ui-scale`,
 * set from here at start-up). The 2D plan and 3D view are not scaled, so their pointer maths stays in
 * plain screen pixels.
 *
 * A zoomed element's `left` / `top` / sizes are scaled too. Popups placed at a screen position (a
 * pointer, a button's rectangle from `getBoundingClientRect`, which is in screen pixels) must set
 * their position with `toUi(px)`; sizes read from such an element with `offsetWidth` are in its own
 * (unscaled) pixels, `fromUi` turns them into screen pixels.
 */
export const UI_SCALE = 0.94;

/** Screen pixels → CSS pixels of a scaled element (for `left`, `top`, `max-height`…). */
export const toUi = (px: number): number => px / UI_SCALE;

/** CSS pixels of a scaled element (`offsetWidth`, `clientHeight`…) → screen pixels. */
export const fromUi = (px: number): number => px * UI_SCALE;

/** Puts the scale on the page (the CSS falls back to the same value). */
export function applyUiScale(): void {
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--ui-scale', String(UI_SCALE));
}
