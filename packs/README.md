# Content packs

Extra furniture and decorations for Neest, like expansion packs in The Sims. A pack is **one file**, `packs/<pack-id>.pack.ts`. It can add:

- **Items:** furniture, fixtures and decorations, built with the same helpers as the built-in library.
- **Materials:** procedural (built-in or the pack's own patterns) or bitmap (images embedded in the file).
- **Patterns:** the pack's own procedural textures.

Pack items appear in the library next to the built-in ones, in their room and type shelves. Hovering a card shows which pack it comes from, and so does the info panel of a placed item. The original library files are never touched.

## Add a pack

1. Copy `_template.pack.ts` to `packs/<your-pack-id>.pack.ts`. Use lowercase letters, digits and dashes, for example `scandi-living.pack.ts`.
2. Edit the name, items and materials.
3. Save. While Neest is running (`npm run dev` or `start-neest.bat`), the pack loads into the open app straight away, with no page refresh. Editing or deleting the file also updates the app live.

Files starting with `_` are ignored. Delete a pack file to remove the pack. Projects that use its items keep them as placeholder boxes until the pack is back.

## Rules

First read the house rules in [KNOWLEDGEBASE.md §12 "Asset rules"](../KNOWLEDGEBASE.md). `npm test` enforces them:

- a specific name, a description and 3+ tags;
- plants in `category: 'plants'` with `plant: PLANT_SPECIES[...]`;
- branded items with `brand`, in `branded-*.pack.ts`;
- a pre-rendered thumbnail from `npm run thumbs`.

The format:

- The **pack id** is the file name. Item, material, pattern and texture ids are local to the pack, so in the app an item becomes `<pack-id>:<item-id>`. Packs never clash with the built-in library or with each other.
- **Items** use the built-in asset format (see `src/data/assets/types.ts` and the helpers in `src/data/assets/parts.ts`; everything is re-exported from `@/packs/kit`):
  - Local space: origin at the centre of the footprint on the floor; x = width, y = up, **+z = front**.
  - `build(size)` returns parts that stay inside the size box at every size between `minSize` and `maxSize`.
  - 1–4 material `slots`. A slot's default material is a built-in id or one of the pack's material ids.
  - `category` (room), `type` (what it is) and `group` (shelf) decide where it shows up. Groups are listed in `ASSET_GROUPS` (`src/data/assets/catalog.ts`).
  - Items that glow need a slot with id `light` whose material has `emissive`, plus a `light` (`AssetLight` in `src/data/assets/types.ts`):
    - `{ color, intensity, distance, y }` is a point light at the item's centre line, `y` above its base. Add `x`/`z` to move the bulb to where the glowing part is (an arc lamp's shade, a swing arm's head).
    - `kind: 'spot'` makes a cone along `dir` (default straight down), with `angle` (half-angle in radians) and `penumbra`. Use it for downlights, track heads, reading, desk and picture lights.
    - `heads: [{ x?, y, z?, dir? }, …]` gives a fixture several bulbs (track heads, up/down sconces). Keep it to a few: each head is a separate light.
    - Positions are at the default size and scale, turn and mirror with the placed item. The checks require every head to sit inside the item.
    - The live view lights the fixtures nearest to the camera from a fixed pool (Balanced: 4 point + 3 spot, High: 8 + 6, with shadows from the 2 nearest spots), so many lamps in a project cost no more than a few.
  - Mark detail parts `plan: false` so the 2D symbol stays clean, and add `planDetail` strokes if useful.
- **Materials:**
  - `pattern: { id, scale }` uses a built-in procedural pattern (such as `weave`, `wood-grain`, `marble`, `leather`, `jute`) or one of the pack's own `patterns`.
  - `image: { color, normal?, roughness?, scale }` names textures in the pack's `textures` map. Textures are embedded as `data:image/png;base64,…` (or jpeg/webp) strings, so the pack stays a single file. Use a white `color` to show a bitmap as painted; other colours tint it.
  - `photo: { set, scale?, contrast? }` uses one of Neest's shared CC0 photo sets (ids in `src/data/materials/photoSets.json`, such as `leaf-blade`, `bark-furrowed`, `potting-soil`, `moss`), tinted by `color`. Keep a `pattern` too: it shows until the photo has loaded and wherever photo files are missing.
  - Keep embedded images small (256–512 px, seamless) so the file stays light.
- **Patterns:** `draw(ctx, size, rand)` paints one seamless tile. Use near-white luminance (the material colour tints it) unless `colored: true`, and use `rand` instead of `Math.random` so it renders the same every time.
- Mistakes don't break the app. A pack that fails to load, or an item whose `build` throws, is reported in the browser console, and broken items show as plain boxes.

## Make items editable in the shape editor

Building parts and built furniture open in Neest's **shape editor**: people move, resize, scale and hide an item's
parts, resize its sections (the compartments between dividers, the levels between fixed shelves) and change named
settings. Which items get it: structure (not radiators), storage (not baskets and boxes), tables and desks (not
outdoor ones), beds, sofas, dining and living chairs, stools and benches, kids' furniture. Never branded items or
items with a shipped mesh. When you add such items:

- **Make each real piece one part.** A door, a shelf, a divider, a leg, a desk top: one part each, not merged with
  its neighbours and not cut into slices.
- **Keep the part order stable.** The same parts in the same order at every size where you can; parts that come and
  go with the size (extra doors, more shelves) go at the end. Edits are stored by part index.
- **Build compartments from real panels.** Dividers: upright panels up to 5 cm thick, standing 55 %+ of the height and
  30 %+ of the depth, in the same slot as the item's end panels. Fixed shelves: flat panels up to 5 cm thick across
  35 %+ of the width and 30 %+ of the depth, in the slot of its top or bottom. Carcass blocks, niches and arms in the
  plan outline mark sections too. The editor finds sections from these.
- **Keep props apart.** Clothes, books, towels and other dressing get their own slot and `plan: false`.
- **Draw arches as prisms** (unturned, or turned a quarter about x like `panelXY`): their curves then follow a
  moved section edge point by point.
- **Offer named settings for spec-built families.** If your items are built from a spec object (see `portal()` in
  `portal-frames.pack.ts`), add `params` (`{ id, label, kind: 'length' | 'count' | 'toggle' | 'choice', default, min,
  max }`) and read them in `build: (size, params) => …`. A missing value means the spec's own, so the item builds
  exactly as before. `npx vitest run src/data/assets/itemEdits.test.ts` checks every item with settings.

## Check a pack

```bash
npx vitest run src/packs
```

This runs every pack item through the same checks as the built-in library: size bounds, slots, materials and lights.
Also run `npx vitest run src/data/assets` for the house rules, and run `npm run thumbs` once your items look right,
so they ship with thumbnails.

## Example

`halloween.pack.ts` contains 10 items: a jack-o'-lantern and a cauldron that both glow, a gravestone, a ghost, a spider web and more. It shows:

- built-in patterns
- its own procedural pattern (`pumpkin-ribs`)
- two embedded bitmap textures (mossy stone, candy stripes)
