/** Neest mark: a nest-like roofline over an open doorway. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <rect width="64" height="64" rx="15" fill="var(--surface-inverse)" />
      <path d="M16 46V24l16-10 16 10v22" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M26 46V33h12v13" fill="none" stroke="var(--text-inverse)" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}
