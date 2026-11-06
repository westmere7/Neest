import { NEST_MARK } from './nestMark';

/**
 * Neest mark: the nest logo (public/logo/Nest_logo.svg) on its own, drawn in the theme's accent
 * (deep teal in light mode, mint in dark mode) through `.logo-mark` in components.css.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox={NEST_MARK.viewBox} aria-hidden focusable="false">
      {NEST_MARK.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
