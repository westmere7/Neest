const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Generates a stable, collision-resistant id with a readable entity prefix. */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % 36];
  return `${prefix}_${s}`;
}
