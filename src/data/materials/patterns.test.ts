import { MATERIAL_CATALOG } from '@/data/materials/catalog';
import {
  TEXTURE_PATTERNS,
  TEXTURE_PATTERN_IDS,
  mulberry32,
  patternDataUrl,
  renderNormalMap,
  renderPattern,
} from '@/data/materials/patterns';

// ---------------------------------------------------------------------------
// Minimal fake CanvasRenderingContext2D (jsdom has no 2D canvas)
// ---------------------------------------------------------------------------

interface FakeImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface FakeContext {
  ctx: CanvasRenderingContext2D;
  calls: string[];
  /** Last image written with putImageData. */
  image: FakeImageData | null;
}

function createFakeContext(width: number, height: number): FakeContext {
  const fake: FakeContext = { ctx: null as unknown as CanvasRenderingContext2D, calls: [], image: null };
  let surface = new Uint8ClampedArray(width * height * 4);
  const record =
    (name: string) =>
    (..._args: unknown[]): void => {
      fake.calls.push(name);
    };
  const gradient = (name: string) => (): { addColorStop: (offset: number, color: string) => void } => {
    fake.calls.push(name);
    return { addColorStop: record('addColorStop') };
  };
  const image = (w: number, h: number): FakeImageData => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  });
  const target: Record<string, unknown> = {
    canvas: { width, height },
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    ellipse: record('ellipse'),
    closePath: record('closePath'),
    fill: record('fill'),
    stroke: record('stroke'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    setTransform: record('setTransform'),
    drawImage: record('drawImage'),
    clip: record('clip'),
    rect: record('rect'),
    quadraticCurveTo: record('quadraticCurveTo'),
    bezierCurveTo: record('bezierCurveTo'),
    createLinearGradient: gradient('createLinearGradient'),
    createRadialGradient: gradient('createRadialGradient'),
    createImageData: (w: number, h: number): FakeImageData => {
      fake.calls.push('createImageData');
      return image(w, h);
    },
    getImageData: (_x: number, _y: number, w: number, h: number): FakeImageData => {
      fake.calls.push('getImageData');
      return { width: w, height: h, data: surface.slice(0, w * h * 4) };
    },
    putImageData: (img: FakeImageData): void => {
      fake.calls.push('putImageData');
      fake.image = img;
      if (img.data.length === surface.length) surface = new Uint8ClampedArray(img.data);
    },
  };
  fake.ctx = new Proxy(target, {
    get(t, key) {
      if (typeof key === 'string' && !(key in t)) throw new Error(`fake ctx: unsupported member "${key}"`);
      return Reflect.get(t, key);
    },
    set(t, key, value) {
      fake.calls.push(`set:${String(key)}`);
      return Reflect.set(t, key, value);
    },
  }) as unknown as CanvasRenderingContext2D;
  return fake;
}

function drawWithFake(id: string, size: number, seed = 1234): FakeImageData {
  const fake = createFakeContext(size, size);
  TEXTURE_PATTERNS[id].draw(fake.ctx, size, mulberry32(seed));
  if (!fake.image) throw new Error(`${id} did not write any pixels`);
  return fake.image;
}

const luminance = (d: Uint8ClampedArray, p: number): number =>
  (0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]) / 255;

/** Mean absolute luminance step across the wrap seam vs. the largest step between interior neighbours. */
function seamStats(img: FakeImageData, axis: 'x' | 'y'): { seam: number; maxInterior: number } {
  const N = img.width;
  const at = (a: number, b: number): number => luminance(img.data, axis === 'x' ? b * N + a : a * N + b);
  const lineDiff = (a0: number, a1: number): number => {
    let s = 0;
    for (let b = 0; b < N; b++) s += Math.abs(at(a1, b) - at(a0, b));
    return s / N;
  };
  let maxInterior = 0;
  for (let a = 0; a < N - 1; a++) maxInterior = Math.max(maxInterior, lineDiff(a, a + 1));
  return { seam: lineDiff(N - 1, 0), maxInterior };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('texture pattern registry', () => {
  it('implements every patternId referenced by the material catalog', () => {
    const used = new Set(MATERIAL_CATALOG.flatMap((m) => (m.texture ? [m.texture.patternId] : [])));
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) expect(TEXTURE_PATTERNS[id], `missing pattern "${id}"`).toBeDefined();
  });

  it('lists exactly the registered ids', () => {
    expect([...TEXTURE_PATTERN_IDS].sort()).toEqual(Object.keys(TEXTURE_PATTERNS).sort());
    expect(new Set(TEXTURE_PATTERN_IDS).size).toBe(TEXTURE_PATTERN_IDS.length);
    expect(TEXTURE_PATTERN_IDS).toHaveLength(52);
  });

  it('has consistent metadata', () => {
    for (const id of TEXTURE_PATTERN_IDS) {
      const p = TEXTURE_PATTERNS[id];
      expect(p.id).toBe(id);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.normalStrength).toBeGreaterThanOrEqual(0);
      expect(p.normalStrength).toBeLessThanOrEqual(1.5);
    }
    expect(TEXTURE_PATTERN_IDS.filter((id) => TEXTURE_PATTERNS[id].colored).sort()).toEqual([
      'art',
      'books',
      'cement-tile',
      'cement-tile-lotus',
      'rug-geometric',
      'wallpaper-botanical',
      'wallpaper-floral',
    ]);
  });
});

describe('mulberry32', () => {
  it('is deterministic for a seed and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const sa = Array.from({ length: 8 }, () => a());
    const sb = Array.from({ length: 8 }, () => b());
    expect(sa).not.toEqual(sb);
  });
});

// ---------------------------------------------------------------------------
// Drawing every pattern against the fake context
// ---------------------------------------------------------------------------

describe.each(TEXTURE_PATTERN_IDS)('pattern "%s"', (id) => {
  const pattern = TEXTURE_PATTERNS[id];

  it('draws a full opaque 64px tile without throwing', () => {
    const fake = createFakeContext(64, 64);
    expect(() => pattern.draw(fake.ctx, 64, mulberry32(1234))).not.toThrow();
    expect(fake.calls).toContain('putImageData');
    const img = fake.image;
    expect(img).not.toBeNull();
    if (!img) return;
    expect(img.width).toBe(64);
    expect(img.height).toBe(64);
    expect(img.data).toHaveLength(64 * 64 * 4);
    expect(img.data.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    expect(drawWithFake(id, 64, 99).data).toEqual(drawWithFake(id, 64, 99).data);
  });

  it(pattern.colored ? 'is multi-coloured' : 'is a near-white grayscale luminance tile', () => {
    const { data } = drawWithFake(id, 64);
    let sum = 0;
    let gray = true;
    for (let p = 0; p < 64 * 64; p++) {
      sum += luminance(data, p);
      if (data[p * 4] !== data[p * 4 + 1] || data[p * 4 + 1] !== data[p * 4 + 2]) gray = false;
    }
    const mean = sum / (64 * 64);
    if (pattern.colored) {
      expect(gray).toBe(false);
    } else {
      expect(gray).toBe(true);
      expect(mean).toBeGreaterThan(0.6);
      expect(mean).toBeLessThan(0.97);
    }
  });

  it('repeats seamlessly (no wrap edge stronger than an interior edge)', () => {
    const img = drawWithFake(id, 128);
    // Book rows stand on a shelf board, so the bottom→top wrap is a deliberate shelf edge.
    const axes: Array<'x' | 'y'> = id === 'books' ? ['x'] : ['x', 'y'];
    for (const axis of axes) {
      const { seam, maxInterior } = seamStats(img, axis);
      expect(seam, `${axis} seam`).toBeLessThanOrEqual(maxInterior * 1.05 + 0.01);
    }
  });
});

// ---------------------------------------------------------------------------
// Canvas rendering helpers
// ---------------------------------------------------------------------------

describe('canvas rendering in jsdom (no 2D context)', () => {
  beforeEach(() => {
    // jsdom reports "not implemented" for getContext through console.error.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null without throwing', () => {
    expect(() => renderPattern('paint')).not.toThrow();
    expect(renderPattern('paint')).toBeNull();
    expect(renderPattern('brick', 256, 0.5)).toBeNull();
    expect(renderNormalMap('brick')).toBeNull();
    expect(patternDataUrl('wood-planks')).toBeNull();
    expect(patternDataUrl('art', 64, 0.4)).toBeNull();
  });

  it('returns null for unknown ids', () => {
    expect(renderPattern('nope')).toBeNull();
    expect(renderPattern('toString')).toBeNull();
    expect(renderNormalMap('nope')).toBeNull();
    expect(patternDataUrl('nope')).toBeNull();
  });
});

describe('canvas rendering with a stubbed 2D context', () => {
  type PatternsModule = typeof import('@/data/materials/patterns');
  let mod: PatternsModule;
  const contexts = new WeakMap<HTMLCanvasElement, FakeContext>();

  beforeEach(async () => {
    vi.resetModules();
    mod = await import('@/data/materials/patterns');
    const getContext = function (this: HTMLCanvasElement): CanvasRenderingContext2D {
      let fake = contexts.get(this);
      if (!fake) {
        fake = createFakeContext(this.width, this.height);
        contexts.set(this, fake);
      }
      return fake.ctx;
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      getContext as unknown as HTMLCanvasElement['getContext'],
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders and caches pattern canvases', () => {
    const a = mod.renderPattern('tile-square', 32);
    expect(a).toBeInstanceOf(HTMLCanvasElement);
    expect(a?.width).toBe(32);
    expect(mod.renderPattern('tile-square', 32)).toBe(a);
    const fake = a ? contexts.get(a) : undefined;
    expect(fake?.image?.data).toHaveLength(32 * 32 * 4);
  });

  it('blends reduced contrast toward white (or the mean colour for colored patterns)', () => {
    const base = mod.renderPattern('brick', 32);
    const soft = mod.renderPattern('brick', 32, 0.3);
    expect(soft).not.toBe(base);
    const calls = soft ? (contexts.get(soft)?.calls ?? []) : [];
    expect(calls).toEqual(
      expect.arrayContaining(['drawImage', 'set:globalAlpha', 'set:fillStyle', 'fillRect']),
    );
    const art = mod.renderPattern('art', 32, 0.5);
    expect(art).toBeInstanceOf(HTMLCanvasElement);
  });

  it('derives a unit-length tangent-space normal map', () => {
    const normal = mod.renderNormalMap('tile-square', 32);
    expect(normal).toBeInstanceOf(HTMLCanvasElement);
    const data = normal ? contexts.get(normal)?.image?.data : undefined;
    expect(data).toHaveLength(32 * 32 * 4);
    if (!data) return;
    let tilted = 0;
    let worstLength = 0;
    let minZ = 1;
    for (let p = 0; p < 32 * 32; p++) {
      const nx = data[p * 4] / 127.5 - 1;
      const ny = data[p * 4 + 1] / 127.5 - 1;
      const nz = data[p * 4 + 2] / 127.5 - 1;
      worstLength = Math.max(worstLength, Math.abs(Math.hypot(nx, ny, nz) - 1));
      minZ = Math.min(minZ, nz);
      if (Math.abs(nx) > 0.1 || Math.abs(ny) > 0.1) tilted++;
    }
    expect(worstLength).toBeLessThan(0.03);
    expect(minZ).toBeGreaterThan(0);
    expect(tilted).toBeGreaterThan(0); // grout lines create relief
    expect(mod.renderNormalMap('tile-square', 32)).toBe(normal);
  });

  it('returns cached data URLs', () => {
    expect(mod.patternDataUrl('marble', 16)).toBe('data:image/png;base64,AAAA');
    expect(mod.patternDataUrl('marble', 16)).toBe('data:image/png;base64,AAAA');
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(1);
    expect(mod.patternDataUrl('nope', 16)).toBeNull();
  });
});
