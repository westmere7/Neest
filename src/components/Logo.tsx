/** Neest mark: bird inside a house silhouette. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className="logo-mark"
      style={{
        borderRadius: Math.round(size * 0.23),
        display: 'block',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  );
}
