/**
 * The 3D model of a live guest link, in pieces named by their content (SHA-256). The server keeps the pieces, the
 * page lists them, and the viewer fetches and joins them. An Update then sends only the pieces the server does not
 * have yet, and guests' browsers keep the pieces they already loaded (a piece never changes).
 *
 * Cuts fall only where the GLB's data blocks (its buffer views) start, and which of those starts end a piece depends
 * on the block's own bytes, not its position: moving one sofa changes the pieces around the sofa's data and the
 * JSON at the front, while every other piece keeps its bytes and its name.
 */

export const PIECE_MIN = 128 * 1024;
/** Pieces stay under 1 MB so each fits in one stored row (the server's rows hold 2 MB). */
export const PIECE_MAX = 1024 * 1024;

export interface ModelPiece {
  hash: string;
  bytes: Uint8Array;
}

/** FNV-1a over the first bytes of a block and its length: a cheap, position-free fingerprint. */
function fingerprint(bytes: Uint8Array, from: number, to: number): number {
  let h = 0x811c9dc5 ^ (to - from);
  const end = Math.min(to, from + 256);
  for (let i = from; i < end; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
  return h >>> 0;
}

/** Offsets where the model is cut (ascending, inside the file). Not a GLB: fixed 1 MB cuts. */
export function pieceCuts(glb: ArrayBuffer): number[] {
  const size = glb.byteLength;
  const bytes = new Uint8Array(glb);
  const cuts: number[] = [];
  let start = 0;
  const cut = (at: number) => {
    if (at > start && at < size) {
      cuts.push(at);
      start = at;
    }
  };
  const view = new DataView(glb);
  const isGlb = size >= 28 && view.getUint32(0, true) === 0x46546c67;
  if (!isGlb) {
    for (let at = PIECE_MAX; at < size; at += PIECE_MAX) cut(at);
    return cuts;
  }
  const jsonLength = view.getUint32(12, true);
  const binStart = 20 + jsonLength + 8;
  let starts: number[] = [];
  try {
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength))) as { bufferViews?: { byteOffset?: number }[] };
    starts = [...new Set((json.bufferViews ?? []).map((v) => binStart + (v.byteOffset ?? 0)))].filter((s) => s >= binStart && s < size).sort((a, b) => a - b);
  } catch {
    /* unreadable JSON: the binary part is cut in fixed steps below */
  }
  // The header and the JSON (which changes with every edit) are a piece of their own.
  cut(binStart);
  if (!starts.length || starts[0] !== binStart) starts.unshift(binStart);
  for (let i = 0; i < starts.length; i++) {
    const a = starts[i];
    const b = starts[i + 1] ?? size;
    if (b - a > PIECE_MAX) {
      // One large block (a texture, a big mesh): on its own, in 1 MB slices.
      cut(a);
      for (let at = a + PIECE_MAX; at < b; at += PIECE_MAX) cut(at);
      cut(b);
      continue;
    }
    if (b - start > PIECE_MAX) cut(a);
    if (b - start >= PIECE_MIN && fingerprint(bytes, a, b) % 4 === 0) cut(b);
  }
  return cuts;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const align = (n: number, to: number) => Math.ceil(n / to) * to;

interface GlbJson {
  buffers?: { byteLength: number; uri?: string }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[];
}

/**
 * The same GLB with its data blocks in a fixed order (sorted by their content). The exporter writes blocks in the
 * order textures finish loading, which varies between builds; without this, one shifted block would move every
 * block after it and make most pieces look new. Readers find blocks by their recorded offsets, so the model is the
 * same. Anything unexpected (not a GLB, several buffers) comes back unchanged.
 */
export async function normalizeGlb(glb: ArrayBuffer): Promise<ArrayBuffer> {
  const view = new DataView(glb);
  if (glb.byteLength < 28 || view.getUint32(0, true) !== 0x46546c67) return glb;
  const jsonLength = view.getUint32(12, true);
  const binHeader = 20 + jsonLength;
  if (binHeader + 8 > glb.byteLength || view.getUint32(binHeader + 4, true) !== 0x004e4942) return glb;
  const binStart = binHeader + 8;
  let json: GlbJson;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength))) as GlbJson;
  } catch {
    return glb;
  }
  const views = json.bufferViews ?? [];
  if (!views.length || (json.buffers?.length ?? 0) !== 1 || views.some((v) => v.buffer !== 0)) return glb;
  const bytesOf = (v: { byteOffset?: number; byteLength: number }) => new Uint8Array(glb, binStart + (v.byteOffset ?? 0), v.byteLength);
  const keys = await Promise.all(views.map(async (v) => hex(await crypto.subtle.digest('SHA-1', bytesOf(v)))));
  // Each distinct block once (identical ones — the same mesh or texture written twice — share its bytes), in the
  // order of their content: a build that happens to share a block and one that wrote it twice come out the same.
  const first = new Map<string, number>();
  views.forEach((_, i) => first.has(keys[i]) || first.set(keys[i], i));
  const unique = [...first.keys()].sort();
  const placed = new Map<string, number>();
  let at = 0;
  for (const key of unique) {
    at = align(at, 16);
    placed.set(key, at);
    at += views[first.get(key)!].byteLength;
  }
  const binLength = align(at, 4);
  const bin = new Uint8Array(binLength);
  for (const key of unique) bin.set(bytesOf(views[first.get(key)!]), placed.get(key)!);
  const offsets = views.map((_, i) => placed.get(keys[i])!);
  const out: GlbJson = { ...json, buffers: [{ ...json.buffers![0], byteLength: binLength }], bufferViews: views.map((v, i) => ({ ...v, byteOffset: offsets[i] })) };
  const text = new TextEncoder().encode(JSON.stringify(out));
  const textLength = align(text.length, 4);
  const total = 12 + 8 + textLength + 8 + binLength;
  const result = new Uint8Array(total);
  const w = new DataView(result.buffer);
  w.setUint32(0, 0x46546c67, true);
  w.setUint32(4, 2, true);
  w.setUint32(8, total, true);
  w.setUint32(12, textLength, true);
  w.setUint32(16, 0x4e4f534a, true);
  result.fill(0x20, 20, 20 + textLength);
  result.set(text, 20);
  w.setUint32(20 + textLength, binLength, true);
  w.setUint32(24 + textLength, 0x004e4942, true);
  result.set(bin, 28 + textLength);
  return result.buffer;
}

/** The model in pieces with their names (the first 32 hex digits of SHA-256). Pass a normalized GLB (normalizeGlb). */
export async function splitModel(glb: ArrayBuffer): Promise<{ size: number; pieces: ModelPiece[] }> {
  const bounds = [0, ...pieceCuts(glb), glb.byteLength];
  const pieces: ModelPiece[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const bytes = new Uint8Array(glb, bounds[i], bounds[i + 1] - bounds[i]);
    pieces.push({ hash: hex(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 32), bytes });
  }
  return { size: glb.byteLength, pieces };
}
