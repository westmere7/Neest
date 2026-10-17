/**
 * Pack template — copy this file to `packs/<your-pack-id>.pack.ts` (lowercase, dashes) and edit.
 * Files starting with "_" are ignored, so this template never shows up in the app.
 * Save the file while Neest is running and the items appear in the library straight away.
 */
import { cushion, defineItem, definePack, legs4, matSlot, span } from '@/packs/kit';

const bench = defineItem({
  id: 'cosy-bench', // unique within the pack; becomes "<pack-id>:cosy-bench"
  name: 'Cosy bench', // shown in the library; must not clash with other item names
  category: 'living', // room: living, bedroom, kids, dining, kitchen, bathroom, laundry, office, hobbies, outdoor, storage, lighting, decor, electronics
  type: 'seating', // what it is: seating, beds, surfaces, storage, appliances, plumbing, lighting, decor, plants, electronics, activities, kids
  group: 'Stools & benches', // shelf name — see ASSET_GROUPS in src/data/assets/catalog.ts
  tags: ['bench', 'seat'],
  defaultSize: { w: 1.2, d: 0.4, h: 0.45 }, // metres: width, depth (front = +z), height
  minSize: { w: 0.6, d: 0.3, h: 0.35 },
  maxSize: { w: 2.0, d: 0.6, h: 0.55 },
  slots: [
    matSlot('frame', 'Frame', 'wood-oak-light'), // built-in material id…
    matSlot('cushion', 'Cushion', 'warm-check'), // …or one of this pack's materials
  ],
  // Origin = centre of the footprint on the floor; x = width, y = up, z = depth (+z = front).
  build: ({ w, d, h }) => [
    span('frame', [-w / 2, w / 2], [h - 0.1, h - 0.06], [-d / 2, d / 2]),
    ...legs4('frame', w, d, 0.03, 0, h - 0.1, 0.045, { round: true, taper: 0.7 }),
    cushion('cushion', [-w / 2 + 0.02, w / 2 - 0.02], [h - 0.06, h], [-d / 2 + 0.02, d / 2 - 0.02]),
  ],
});

export default definePack({
  name: 'My pack',
  version: '1.0.0',
  author: 'Your name',
  description: 'What is in this pack.',
  license: 'CC0',
  items: [bench],
  materials: [
    // Procedural: any built-in pattern (weave, wood-grain, marble, …) or one from `patterns` below.
    { id: 'warm-check', name: 'Warm check', category: 'fabric', color: '#b5694c', roughness: 0.9, pattern: { id: 'weave', scale: 0.12 } },
    // Bitmap: name a texture from `textures` (white colour shows it as painted).
    // { id: 'my-fabric', name: 'My fabric', category: 'fabric', color: '#ffffff', image: { color: 'my-fabric', scale: 0.3 } },
  ],
  // patterns: [{ id: 'dots', name: 'Dots', draw(ctx, size, rand) { /* seamless, near-white */ } }],
  // textures: { 'my-fabric': 'data:image/png;base64,…' },
});
