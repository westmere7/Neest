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
  - Keep embedded images small (256–512 px, seamless) so the file stays light.
- **Patterns:** `draw(ctx, size, rand)` paints one seamless tile. Use near-white luminance (the material colour tints it) unless `colored: true`, and use `rand` instead of `Math.random` so it renders the same every time.
- Mistakes don't break the app. A pack that fails to load, or an item whose `build` throws, is reported in the browser console, and broken items show as plain boxes.

## Check a pack

```bash
npx vitest run src/packs
```

This runs every pack item through the same checks as the built-in library: size bounds, slots, materials and lights.

## Example

`halloween.pack.ts` contains 10 items: a jack-o'-lantern and a cauldron that both glow, a gravestone, a ghost, a spider web and more. It shows:

- built-in patterns
- its own procedural pattern (`pumpkin-ribs`)
- two embedded bitmap textures (mossy stone, candy stripes)
