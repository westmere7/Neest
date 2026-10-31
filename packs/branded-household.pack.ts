/**
 * Branded household items: small home goods from named makers at their published sizes, in the
 * colours they are sold in.
 */
import { cyl, defineItem, definePack, matSlot, prism, rod, roundRectPoints, type AssetBrand, type Part, type Size3 } from '@/packs/kit';

const o = { plan: false };

function fixed(w: number, d: number, h: number) {
  const s: Size3 = { w, d, h };
  return { defaultSize: s, minSize: s, maxSize: s, resizable: { w: false, d: false, h: false } };
}

const brand = (name: string, model: string, line: string, url: string, specs: [string, string][]): AssetBrand => ({ name, model, line, url, specs });

/** Rounded slab lying flat. */
const slab = (slot: string, w: number, d: number, r: number, y0: number, h: number, plan = true): Part =>
  prism(slot, roundRectPoints(0, 0, w, d, r, 6), y0, h, plan ? undefined : o);

// ---------------------------------------------------------------------------
// UFORU 16L slim rolling trash can (DB1513)
// ---------------------------------------------------------------------------

/**
 * A slim 16 L bin on four splayed legs with swivel casters: a rounded-rectangle body with a press-seal
 * lid, a short tapered collar under it where the legs meet, and black casters. 360 × 235 × 675 mm
 * overall (legs and wheels included), as the maker lists it.
 */
function uforuRollingBin({ w, d, h }: Size3): Part[] {
  const bodyW = 0.3;
  const bodyD = 0.2;
  const yCollar = 0.3;
  const yBody = 0.335;
  const yLid = h - 0.045;
  const wheelR = 0.022;
  const cx = w / 2 - 0.03;
  const cz = d / 2 - 0.03;
  const parts: Part[] = [
    // Tapered collar where the legs meet the body.
    slab('body', bodyW - 0.03, bodyD - 0.03, 0.03, yCollar, 0.02),
    slab('body', bodyW - 0.012, bodyD - 0.012, 0.037, yCollar + 0.02, yBody - yCollar - 0.02),
    // Body, with a thin seam just under the lid.
    slab('body', bodyW, bodyD, 0.04, yBody, yLid - yBody - 0.004),
    slab('lid', bodyW - 0.004, bodyD - 0.004, 0.038, yLid - 0.004, 0.004, false),
    // Press-seal lid: a rim and a slightly smaller domed top.
    slab('lid', bodyW + 0.004, bodyD + 0.004, 0.042, yLid, 0.026, false),
    slab('lid', bodyW - 0.012, bodyD - 0.012, 0.034, yLid + 0.026, h - yLid - 0.026, false),
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const fx = sx * cx;
      const fz = sz * cz;
      // Leg: from the collar corner out to the caster.
      parts.push(rod('body', [fx, 2 * wheelR + 0.012, fz], [sx * (bodyW / 2 - 0.045), yCollar + 0.01, sz * (bodyD / 2 - 0.04)], 0.011, { segments: 10, plan: false }));
      // Swivel caster: a short stem, the fork and a wheel lying across.
      parts.push(
        cyl('casters', [fx, 2 * wheelR + 0.006, fz], 0.012, 0.012, o),
        cyl('casters', [fx, wheelR, fz], wheelR, 0.016, { rotation: [Math.PI / 2, 0, 0], segments: 16, plan: false }),
      );
    }
  }
  return parts;
}

const uforuBin = defineItem({
  id: 'uforu-16l-slim-rolling-trash-can',
  name: 'UFORU 16L slim rolling trash can',
  category: 'kitchen',
  type: 'storage',
  group: 'Baskets & boxes',
  tags: ['branded', 'uforu', 'trash can', 'thùng rác', 'thùng rác có bánh xe', 'slim', 'gap bin', 'rolling', 'lockable wheels', 'kitchen'],
  description:
    'A slim 16 L polypropylene bin on four splayed legs with swivel casters (the front two lock): rounded body with a press-seal lid and silicone rim, an inner bucket inside, made for gaps beside counters, vanities and desks.',
  ...fixed(0.36, 0.235, 0.675),
  mount: 'floor',
  defaultElevation: 0,
  slots: [matSlot('body', 'Body & legs', 'pp-cream'), matSlot('lid', 'Lid', 'pp-cream'), matSlot('casters', 'Casters', 'plastic-black')],
  variants: [
    { id: 'cream-white', name: 'Cream White (DB1513-1)', materials: { body: 'pp-cream', lid: 'pp-cream' } },
    { id: 'green', name: 'Green (DB1513-2)', materials: { body: 'pp-olive', lid: 'pp-olive' } },
    { id: 'red', name: 'Red (DB1513-3)', materials: { body: 'pp-red', lid: 'pp-red' } },
    { id: 'brown-white', name: 'Brown/White (DB1513-9)', materials: { body: 'pp-cream', lid: 'pp-brown' } },
  ],
  // No Vietnamese listed price could be read (Shopee VN); estimated from the Korean Coupang listing
  // (25,700 KRW). The maker's US store lists 74.99 USD (59.98 USD on sale).
  price: { vnd: 480_000, estimate: true },
  brand: brand('UFORU', 'DB1513', '16L Slim Rolling Trash Can with Lockable Wheels', 'https://uforuhome.com/products/16l-rolling-trash-can-lockable-wheels-slim', [
    ['Capacity', '16 L (about 4.2 gal)'],
    ['Size (W × D × H)', '14.17 × 9.25 × 26.57 in (360 × 235 × 675 mm, with wheels)'],
    ['Material', 'Heavy-duty polypropylene & ABS (waterproof, rustproof)'],
    ['Lid', 'Airtight pressure-sealing lid with silicone perimeter'],
    ['Wheels', '360° swivel casters, front wheels lock'],
    ['Inside', 'Removable inner bucket ("binocular design"), hidden bag fixing ring'],
    ['Colours', 'Cream White (DB1513-1), Green (DB1513-2), Red (DB1513-3), Brown/White (DB1513-9)'],
  ]),
  build: uforuRollingBin,
});

export default definePack({
  name: 'Branded household',
  version: '1.0.0',
  author: 'Neest team',
  description: 'Small household goods from named makers at their published sizes and in the colours they are sold in: the UFORU 16L slim rolling trash can.',
  license: 'CC0 (made for Neest); brand names belong to their owners',
  materials: [
    { id: 'pp-cream', name: 'Cream white polypropylene', category: 'solid', color: '#ebe3d1', roughness: 0.55 },
    { id: 'pp-olive', name: 'Olive green polypropylene', category: 'solid', color: '#94a067', roughness: 0.55 },
    { id: 'pp-red', name: 'Red polypropylene', category: 'solid', color: '#b8302e', roughness: 0.5 },
    { id: 'pp-brown', name: 'Brown polypropylene', category: 'solid', color: '#8a5434', roughness: 0.55 },
  ],
  items: [uforuBin],
});
