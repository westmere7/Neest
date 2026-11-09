// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PIECE_MAX, normalizeGlb, splitModel } from './guestPieces';

/** A GLB-shaped buffer: header, a JSON chunk listing the blocks, and the blocks one after another (4-byte aligned). */
function fakeGlb(blocks: Uint8Array[]): ArrayBuffer {
  const offsets: number[] = [];
  let at = 0;
  for (const b of blocks) {
    offsets.push(at);
    at += Math.ceil(b.length / 4) * 4;
  }
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, buffers: [{ byteLength: at }], bufferViews: blocks.map((b, i) => ({ buffer: 0, byteOffset: offsets[i], byteLength: b.length })) }));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const out = new Uint8Array(20 + jsonLength + 8 + at);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, out.length, true);
  v.setUint32(12, jsonLength, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(json, 20);
  v.setUint32(20 + jsonLength, at, true);
  v.setUint32(24 + jsonLength, 0x004e4942, true);
  blocks.forEach((b, i) => out.set(b, 28 + jsonLength + offsets[i]));
  return out.buffer;
}

let seed = 7;
const random = (n: number) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (seed = (seed * 16807) % 2147483647) & 255;
  return b;
};

describe('model pieces for live guest links', () => {
  // 400 blocks of 4–90 kB (meshes) and a few large ones (textures), about 20 MB.
  const blocks = Array.from({ length: 400 }, (_, i) => random(i % 97 === 0 ? 1_500_000 : 4_000 + ((i * 7919) % 86_000)));

  it('cover the model exactly, in order, each under the size limit', async () => {
    const glb = fakeGlb(blocks);
    const { size, pieces } = await splitModel(glb);
    expect(size).toBe(glb.byteLength);
    expect(pieces.length).toBeGreaterThan(10);
    for (const p of pieces) expect(p.bytes.length).toBeLessThanOrEqual(PIECE_MAX);
    const joined = new Uint8Array(size);
    let at = 0;
    for (const p of pieces) {
      joined.set(p.bytes, at);
      at += p.bytes.length;
    }
    expect(at).toBe(size);
    const original = new Uint8Array(glb);
    let differ = -1;
    for (let i = 0; i < size && differ < 0; i++) if (joined[i] !== original[i]) differ = i;
    expect(differ).toBe(-1);
  });

  it('a change to one block leaves almost every other piece as it was', async () => {
    const before = await splitModel(fakeGlb(blocks));
    const edited = blocks.slice();
    edited[200] = random(edited[200].length + 3000); // one mesh rebuilt, a little longer
    const after = await splitModel(fakeGlb(edited));
    const had = new Set(before.pieces.map((p) => p.hash));
    const fresh = after.pieces.filter((p) => !had.has(p.hash));
    const freshBytes = fresh.reduce((n, p) => n + p.bytes.length, 0);
    // The JSON piece and the piece(s) around the edited block; not the rest.
    expect(fresh.length).toBeLessThanOrEqual(4);
    expect(freshBytes / after.size).toBeLessThan(0.15);
  });

  it('the same model gives the same pieces', async () => {
    const a = await splitModel(fakeGlb(blocks));
    const b = await splitModel(fakeGlb(blocks));
    expect(b.pieces.map((p) => p.hash)).toEqual(a.pieces.map((p) => p.hash));
  });

  it('the same blocks written in another order give the same pieces once normalized', async () => {
    const shuffled = blocks.slice().reverse();
    // Same blocks, other order: the JSON differs (offsets), every data piece should match.
    const a = await splitModel(await normalizeGlb(fakeGlb(blocks)));
    const b = await splitModel(await normalizeGlb(fakeGlb(shuffled)));
    const had = new Set(a.pieces.map((p) => p.hash));
    const fresh = b.pieces.filter((p) => !had.has(p.hash));
    expect(fresh.length).toBeLessThanOrEqual(2);
    const freshBytes = fresh.reduce((n, p) => n + p.bytes.length, 0);
    expect(freshBytes / b.size).toBeLessThan(0.05);
  });

  it('normalizing keeps every block readable at its recorded offset', async () => {
    const glb = await normalizeGlb(fakeGlb(blocks));
    const v = new DataView(glb);
    const jsonLength = v.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength))) as { bufferViews: { byteOffset: number; byteLength: number }[] };
    const bin = 28 + jsonLength;
    expect(v.getUint32(8, true)).toBe(glb.byteLength);
    json.bufferViews.forEach((bv, i) => {
      expect(bv.byteOffset % 16).toBe(0);
      const got = new Uint8Array(glb, bin + bv.byteOffset, bv.byteLength);
      expect(got[0]).toBe(blocks[i][0]);
      expect(got[got.length - 1]).toBe(blocks[i][blocks[i].length - 1]);
    });
  });
});
