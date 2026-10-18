# Neest — Knowledge Base for Agents and Contributors

> Single source of truth for how Neest is built, why it is built that way, and the traps already found.
> Read this before changing code. Keep it current: when you add a feature, fix a non-obvious bug, or change a
> convention, update the relevant section (and the "Status & roadmap" section) in the same change.

Last updated: 2026-10-18 (houseplants with care guides, bathroom and Vietnam branded packs, materials, colour variants).

---

## 1. What Neest is

A **local-first, browser-based apartment floor planner**: precise 2D drafting (walls, curved walls, rooms, doors,
windows) plus an integrated, editable 3D view, a global material system, a parametric furniture library, a
first-person walkthrough, and exports (scaled PDF/SVG/PNG sheets, DXF, GLB, real-time and path-traced PNG renders,
a single-file guest walkthrough, `.neest` project files, JSON summaries).

- Scope: **one apartment level** per project. No storeys, roofs, terrain or structural engineering.
- No backend, accounts or network services. Everything runs in the browser and persists to IndexedDB. A storage
  seam (`src/storage/repository.ts`) exists for a future Cloudflare backend; do **not** add server code or fake
  endpoints. The only server code is the **dev/preview-server plugin** that mirrors projects into the repo's
  `projects/` folder (§13); production static builds don't have it.
- The product brief lives in `_Prompt/prompt.md` (generated from `_Prompt/InitialPrompt.txt`). Its acceptance
  criteria (§24) are the bar for "done".

## 2. Quick start

```bash
npm install
npm run dev          # builds the guest-viewer runtime first (predev), then starts Vite on :5173
npm test             # Vitest unit/domain tests (jsdom)
npm run typecheck    # guest runtime build + tsc -b
npm run lint
npm run build        # guest runtime + typecheck + production build (PWA, offline precache)
npm run test:e2e     # Playwright (needs `npx playwright install chromium` once)
```

On Windows, double-click **`start-neest.bat`**. On macOS, double-click **`start-neest.command`** in Finder (or run
**`./start-neest.sh`** on macOS/Linux). Each script checks for Node ≥ 20, runs `npm install` when `node_modules` is
missing or outdated, then starts the dev server on port 5173 and opens the browser. Pass `--lan` (`./start-neest.sh --lan`
or `start-neest.bat --lan`) to expose it on the local network, or `--no-open` to skip opening the browser tab.

Changes to source files hot-reload in the open browser (Vite HMR). Changes to project files in `projects/` are
pushed to open editors and the launcher as well (§13).

The dev-only debug handles are `window.__NEEST__` (`{ project, editor }` zustand stores) and
`window.__NEEST_LIVE__.current` (live 3D renderer/scene/camera). Neither exists in production builds.

Environment notes (the original dev machine): Windows 11, Node 22, npm 10, **no Python**. Use Node scripts for
file transforms. In Bash, avoid mixing `'`/`"` inside `node -e "..."`: write a `.cjs` script to the scratchpad and
run it instead. Never start a Bash command with a bare `cat > file` (it waits for stdin and hangs).

## 3. Repository map

```
_Prompt/                 Product brief (prompt.md) and its origin (InitialPrompt.txt)
packs/                   Content packs: one <pack-id>.pack.ts file each (README.md = authoring guide)
projects/                Shared project folder mirrored by the dev server (README.md explains it)
public/                  favicon (PWA icon), textures/ (CC0 photo maps + manifest.json, from `npm run textures`),
                         thumbs/ (pre-rendered library thumbnails + manifest.json, from `npm run thumbs`),
                         swatches/ (pre-rendered material swatches + manifest.json, also from `npm run thumbs`)
start-neest.bat          Windows launcher (Node check, npm install, dev server, browser)
start-neest.command      macOS Finder double-click launcher (invokes start-neest.sh)
start-neest.sh           macOS/Linux shell launcher (Node check, npm install, dev server, browser)
tools/
  neest-workspace-plugin.ts  Vite plugin: /__neest/fs endpoints + projects/ watcher (dev & preview only)
  neest-packs-plugin.ts      Vite plugin: hot-reloads the pack loader when /packs files are added/deleted
  fetch-textures.mjs     `npm run textures`: downloads/re-encodes the CC0 photo texture sets (needs sharp, dev dep)
  generate-thumbs.mjs    `npm run thumbs`: renders every library item in headless Chromium into public/thumbs
                         and every textured material swatch into public/swatches
src/
  main.tsx               React root (+ dev debug hooks)
  app/App.tsx            Hash router: #/ launcher, #/p/:id editor, #/guest/:id guest view
  components/            UI primitives (Button, IconButton+tooltip, LengthField, ColorField, Slider, Segmented,
                         Toggle, Section), Dialog/Confirm/Toasts/PanelLoading, ContextMenu, ThemeSwitch, hooks
                         (useIsMobile), layoutInsets (floating-panel insets used to frame views)
  domain/                Pure, framework-free logic (unit-tested)
    model/               schema.ts (Zod, single source of types), defaults.ts, units.ts, ids.ts
    geometry/            vec, polygon, wallPath (Bézier), walls (junctions, pieces, openings), rooms (face
                         detection), snapping, derive (memoised DerivedPlan)
    commands/            walls.ts + entities.ts: immer recipes for every model edit
    validation/          diagnostics (crossing walls, clamped/overlapping openings, degraded rooms…)
    walkthrough/         collision.ts (2D colliders for first-person walking; shared with guest runtime)
  state/                 projectStore (model + undo/redo/transactions/applyExternal), editorStore (UI state),
                         uiStores (prefs incl. repoSync/theme, toasts, dialogs/confirm)
  storage/               repository.ts (interfaces), indexeddb/db.ts (Dexie impl), migrations/,
                         workspace.ts (client for the repo projects/ folder)
  data/
    assets/              Parametric furniture catalogue (types.ts contract, parts.ts helpers, one file per
                         category, catalog.ts index, registry.ts lookup + plan footprints)
    materials/           catalog.ts (≈130 materials, defaults, photo mapping), patterns.ts (28 procedural seamless
                         textures), photoSets.json/.ts (CC0 photo texture sets)
  features/
    projects/            Launcher, projectService (lifecycle, autosave, repo mirroring, thumbnails),
                         thumbnails.ts (on-demand previews), demoProject (SAMPLES, apartment, studio),
                         loftProject (100 m² stress sample), grandApartmentProject (200 m²
                         stress sample), sampleHelpers (shared sample builders)
    editor/              EditorPage/Shell (top bar, tool rail, status bar, canvas controls), Inspector,
                         EditorDialogs (render/export/settings/shortcuts/…), actions, useShortcuts
    plan-2d/             PlanCanvas (interactive SVG), PlanDrawing (pure renderer shared with exports),
                         symbols (door/window primitives), dimensions, palette, hitTest, contextMenu,
                         tools/ (select, wall, curve, room, opening, place, measure, split)
    scene-3d/            builders (imperative three.js geometry), materialRegistry, SceneContent (R3F),
                         Scene3DView (editor 3D), edit3d (3D tool bridge + transform gizmo), cameraViews,
                         sceneRuntime (shared registry, live-scene handle, PNG capture), pathTrace (path-traced
                         renders), customModels (GLB), thumbnailRenderer, useCanvasMeasureFix (R3F workarounds)
    walkthrough/         WalkControls, TouchControls, GuestPage
    library/             LibraryPanel (Build / Furniture / Materials tabs), thumbnails (visible cards only; shipped
                         file → IndexedDB → render, keyed by thumbFingerprint), ImportModelDialog,
                         useDropAsset
    materials/           MaterialUI (slot rows, finish picker with apply scopes, library, editor, photo/procedural
                         switch), MaterialPanel (desktop finish panel beside the Inspector), textureCache
                         (swatches), photoTextures (manifest, image loading, colour maths)
    exports/             ExportDialog (ExportPanel body, lazy), sheet (scaled vector sheets), planExports
                         (PNG/PDF), dxf, sceneExport (GLB), guestExport (single-file HTML), neestFile (.neest zip),
                         report (JSON)
  guest-viewer/main.ts   Standalone runtime inlined into guest exports (built by vite.guest.config.ts into
                         src/generated/guest-viewer.js, git-ignored)
  styles/                tokens.css (theme tokens + teal/brass palette), base.css
  test/setup.ts          jest-dom + fake-indexeddb
e2e/                     Playwright smoke tests (playwright.config.ts at the root)
```

## 4. Architecture in one picture

```
            user input (2D canvas / 3D view / inspector / shortcuts)
                                   │
                      tools & actions call commands
                                   ▼
  domain/commands (immer recipes) ──► projectStore.execute | begin → preview* → commit | cancel
                                   │      • snapshot history (structural sharing), limit 200
                                   │      • reconcileRooms() after any wall/node change
                                   ▼
                            Project (Zod-typed, metres)
                                   │  derivePlan(project) — memoised on walls/nodes/openings identity
                                   ▼
        DerivedPlan { network (wall geometry, hubs), faces (rooms), faceRooms, diagnostics, bounds }
             │                         │                               │
     PlanDrawing (SVG)          builders + SceneContent (3D)     exports (sheet/DXF/GLB/guest)
     on screen & in sheets      live view, thumbnails, GLB        all from the same model
             │
  projectStore.revision ──► autosave (debounced 700 ms) ──► IndexedDB (Dexie)
                                                        └──► projects/<slug>__<id>.json (dev server only)
```

Principles that must hold:
1. **One model.** 2D, 3D and every export derive from `Project` + `derivePlan`. Never store a second geometry copy.
2. **Pure domain.** `src/domain/**` has no React/DOM. It may use three.js *math* only (`ShapeUtils` triangulation).
3. **Commands mutate, views read.** UI code never edits `Project` directly; it calls `execute`/`preview`.
4. **Derived data is disposable.** `Room.anchor`/`boundaryWallIds` are identity hints, regenerated on reconcile.

## 5. Conventions (do not break)

### Units & coordinates
- Canonical unit: **metres**, stored as numbers. Display conversion only at the UI/export boundary
  (`domain/model/units.ts`: `formatLength`, `parseLength` accepts `3.5`, `350cm`, `10'6"`, `12"`, `2,5`).
- **Plan space**: `(x, y)`, +x right/east, **+y down/south** (SVG convention).
- **Angles** in plan: radians from +x toward +y (clockwise on screen).
- **3D**: plan `(x, y)` ↦ three.js `(x, z)`, +Y up. A plan rotation θ is `object.rotation.y = -θ`.
- **Left/right of a wall**: walking from node `a` to node `b`, "left" is `leftNormal(d) = (d.y, -d.x)`.
  `materials.left/right` and opening `swingSide` use this.
- **Asset local space**: origin at footprint centre on the floor; x = width, z = depth with **+z = front**;
  y up. At rotation 0 an object's front faces +y in the plan (down the screen).

### Code
- TypeScript strict, no `any`. Types come from Zod (`z.infer`) in `schema.ts`.
- IDs: `newId(prefix)` → `w_…`, `n_…`, `door_…`, `win_…`, `obj_…`, `room_…`, `mat_…`, `cam_…`, `blob_…`.
- Immer `setAutoFreeze(false)` (performance). Treat snapshots as immutable anyway.
- Styling: plain CSS files per feature + tokens in `styles/tokens.css` (`[data-theme=light|dark]`). Use tokens,
  not hex colours, in UI CSS. Plan/3D colours live in `plan-2d/palette.ts`.
- **Palette**: the accent is the deep wall teal from the user's reference photo, with brass for snapping.
  Primitives `--teal-50 … --teal-950` and `--brass-400/600`. Light theme: `--accent` = teal-700, `--selection` =
  teal-600, `--snap` = brass-600. Dark theme: `--accent` = teal-300 (text on accent = teal-950), `--snap` =
  brass-400. In 3D overlays and the gizmo the same hues are hard-coded (`#2a8a78` accent, `#d0a650` snap).
  Matching materials: `paint-deep-teal`, `paint-sage-teal`, `fabric-olive`.
- Files exporting both components and constants break React Fast Refresh (Vite logs "Could not Fast
  Refresh"); a full reload is then needed. Acceptable, but don't rely on HMR state when debugging.

## 6. Domain model reference (`src/domain/model/schema.ts`)

| Entity | Key fields & semantics |
| --- | --- |
| `Project` | `format`, `schemaVersion` (1), `id`, `name`, timestamps, `settings`, records `nodes/walls/openings/rooms/objects/materials/customAssets`, `cameras[]`, `render`, `layers`, `guest` |
| `WallNode` | shared endpoint; moving it moves every attached wall end |
| `WallSegment` | `a`,`b` node ids; `thickness`, `height`, `baseElevation`; `role` exterior/interior/partition; `curve` = quadratic Bézier control point or null; `materials {left,right,top}`; `locked`, `hidden` |
| `Opening` | host `wallId`; `kind` (door-single/double/sliding, passage, window-single/double/fixed/sliding); **`offset` = arc length from node `a` to the opening centre**; `width`, `height`, `sillHeight`; `swingSide` left/right; `hinge` start/end; `openAngle` (3D only); `style`; optional `design` (§10); frame/panel material ids |
| `Room` | user data for a detected face: `name`, `type`, floor/ceiling materials, `showCeiling`, `ceilingHeight` (null = lowest bounding wall), label prefs; identity hints `anchor`, `boundaryWallIds` |
| `PlacedObject` | `assetId`, `x`,`y`,`elevation`,`rotation`, `width/depth/height`, `mirrored`, `materials` (slot → material id; missing slots use asset defaults), `locked`, `hidden` |
| `MaterialDefinition` | `color`, `roughness`, `metalness`, `opacity`, `emissive*`, `texture {patternId, scale m/tile, rotation°, contrast}` (procedural, also the fallback), `photo {setId, scale, rotation, contrast, enabled}` (optional CC0 photo set, §12), `overrideOf` (unlinked per-surface copy), `catalogId`, `source` licence |
| `CustomAsset` | imported GLB: `blobId` (IndexedDB), native `size`, normalised top-down `footprint` hull, licence text |
| `CameraPreset` | projection, position, target, fov, zoom, optional `wallDisplay` |
| `RenderSettings` | quality draft/balanced/high, exposure, timeOfDay, sunAzimuth/Intensity, envIntensity, shadows, background, wallDisplay full/cutaway/fade/hidden, cutawayHeight, showCeilings, showRoomLabels, hiddenCategories |
| `guest` | `startCameraId` (Guest View and guest export only; the editor always opens on a fitted view), `spawn`, `spawnAngle` |

Materials referenced by id resolve **project → catalogue → visible fallback** (`resolveMaterial`). Catalogue
materials are copied into `project.materials` only when edited/assigned (`ensureMaterial`), so projects stay
self-contained and catalogue defaults stay shared.

Schema evolution: bump `SCHEMA_VERSION`, add a step to `MIGRATIONS` in `storage/migrations/index.ts`, give new
fields Zod defaults. `migrateProject` rejects newer versions with a clear message and `repairProject` drops
dangling references (with user-visible warnings) instead of crashing. Repo-folder files go through the same
`migrateProject`.

## 7. Geometry (src/domain/geometry)

- **Wall paths** (`wallPath.ts`): straight = 2 samples; curved = Bézier sampled every ~8 cm (12–64 samples) with
  cumulative arc length `s` and tangents. `pointAt`, `projectOnPath`, `splitBezier` (de Casteljau).
- **Junctions** (`walls.ts › computeWallNetwork`): wall ends at a node are sorted by angle; each consecutive pair's
  facing edges are intersected (mitre) with a limit of 6× half-thickness (bevel beyond). Collinear ends use
  perpendicular points. Nodes with ≥3 ends (or bevels) get a **hub polygon** to fill the centre.
- **Openings & pieces**: openings are clamped into the wall's clear range (`clearStart/clearEnd` exclude the
  mitred end extension + 2 cm). The wall is cut into intervals at opening edges: solid intervals become
  full-height **pieces**; opening intervals become **below-sill** and **above-head** pieces. 3D builds prisms from
  pieces, so doors/windows are **real gaps**. `planPieces` (solid only) draw the plan.
- **Rooms** (`rooms.ts`): planar graph of wall centrelines (curves sampled) → prune dangling stubs → half-edge face
  tracing (next = previous edge in angle order at the far vertex; bounded faces have positive signed area) →
  other components' outer loops become **holes** of the smallest containing face → each face edge is inset by its
  wall's half thickness to get the **clear floor polygon** (`inner`); invalid insets fall back and raise a
  diagnostic. Area/perimeter are measured on `inner` (minus holes).
- **Room identity** (`matchFacesToRooms`): score = anchor-inside (1) + Jaccard(boundary wall ids); greedy ≥ 0.34.
- **Snapping** (`snapping.ts`) priority: node → wall midpoint → wall line/face → angle constraint from anchor
  (45° steps; Shift forces) with grid-rounded length and alignment guides → x/y alignment guides → grid.
  Tolerance is a constant screen distance converted to world units by the caller.
- **Collisions** (`walkthrough/collision.ts`): wall pieces overlapping body height 0.35–1.75 m (so doorways are
  open, sills block) + furniture ≥ 0.3 m tall; circle-vs-segment push-out with sub-stepping.
- Performance reference: the 100 m² loft sample (28 walls, 2 curved, 16 openings, ~110 items) derives in well under
  60 ms per full recompute (`loft.test.ts` enforces it).

## 8. Commands (src/domain/commands)

All are immer recipes `(draft, …args)`; call them via `projectStore.execute(label, d => cmd(d, …))`.

- `addWallChain(points, opts)`: endpoints reuse nodes within 2 mm or **split walls they land on**; new straight
  walls get `insertJunctions` (existing nodes on the wall, T-junctions, crossings, collinear overlaps), then
  duplicates are removed. `addRectangleWalls` builds on it (shared edges are not duplicated).
- `splitWallAt(wall, s)`: original id keeps the first part; openings are reassigned by centre offset; a split
  inside an opening moves to the nearest opening edge; curved walls split exactly (de Casteljau).
- `setNodePositions` keeps curved walls' shape relative to their chord. `setWallLength(…, anchor)` moves the
  non-anchored end along the wall (attached walls follow). `settleNode` merges a dropped node into a coincident
  node or wall and adds junctions. `deleteWalls` removes orphan nodes and **heals** collinear identical walls.
- Openings: `addOpening` (presets in `defaults.ts`), `updateOpening`, `clampOpening`.
- Objects: `placeObject`, `updateObjects`, `rotateObjects` (group rotation about centroid), `translateObjects`,
  `duplicateEntities`.
- `deleteEntities` handles any mix; deleting a **room** deletes only the walls bounding no other room.
- Materials: `assignMaterial(targets, id)`, `expandScope(target, scope)` with scopes
  `this | walls-of-role | asset-instances | rooms-of-type | same-material`, `createOverride` (unlink one
  surface), `duplicateMaterial`, `deleteMaterial(id, replacement)`, `updateMaterial`.
- `reconcileRooms` runs automatically after structural edits (projectStore `finalize`).

## 9. State, history, autosave

- `projectStore`: `execute(label, recipe)` = one undo step. Gestures: `begin(label)` → many `preview(recipe)` (not
  recorded, not autosaved) → `commit(finalRecipe?)` (one step) or `cancel()`. Undo/redo restore snapshots;
  redo is cleared on new edits; history capped at 200 entries (structural sharing keeps it small).
- `applyExternal(project, label)` replaces the open project with one that changed on disk (repo folder) as a
  single undoable step **without** bumping `revision`, so autosave does not echo it straight back.
- `revision` increments on committed changes only → autosave (`projectService.startAutosave`) debounces 700 ms,
  flushes on tab hide/close, shows `Saving…/Saved locally HH:MM` (+ `· in repo` when mirrored) or
  `Save failed`, refreshes the launcher thumbnail lazily (presentation-style SVG, 4 s after the last save).
- `editorStore`: tool, selection/hover, workspace (`plan | 3d | split | walk`), planMode
  (`draft | furnished | presentation`), snap settings, plan camera, `requestFit()`, measurements, library panel
  state, `viewPanelOpen` (desktop 3D view panel shown or stashed), `cameraRequest` for 3D views.
- After undo/redo `EditorPage` prunes selections pointing at deleted entities.
- **Layout options** (phương án, `domain/commands/options.ts`, `OptionSwitcher` next to the project name): several
  versions of the plan in one project. `project.options[]` + `activeOptionId`; the active option's plan is the
  project's own `nodes/walls/openings/rooms/objects/groups` (its `plan` is null), the others store theirs in
  `options[i].plan`. Settings, materials, imported models, cameras, render, layers and guest are shared. Switching,
  duplicating (also "same walls, no furniture" and blank), renaming, reordering and deleting are ordinary undoable
  commands; the selection is cleared on a switch (ids belong to one option). No `options` = one implicit "Option A".
  Anything that must reach every option (e.g. `deleteMaterial` reassigning a material) uses `inEveryOption`.
  Exports, the guest viewer and stats show the active option. The popover is portalled to `<body>` (above panels).
  Pitfall: immer does not draft plain values assigned into a draft, so `putPlan` deep-copies any non-draft plan;
  otherwise editing a just-duplicated option in the same recipe wrote into the original option and undo history.
- **Ready-made groups** (`src/data/groups/readyGroups.ts`): furnished setups shipped with Neest (bedrooms, living rooms,
  kitchens, L-shaped kitchens from the `lKitchen` generator, dining, bathrooms, kids, office, balcony, entry), written in
  plan metres with the back of the setup at y = 0. Built into `SavedGroup`s on demand (rebuilt when packs change) and
  shown in the Groups tab by shelf under "Your groups"; ids `ready-…`, asset ids `savedgroup:ready-…`. They place
  like saved groups; "Copy to my groups" makes an editable copy. Tests check items exist, names are unique and every
  group has a description.
- **Group descriptions**: `ObjectGroup.description` and `SavedGroup.description` (≤ 500 chars), edited in the
  "Group name & description" dialog (`GroupDetailsDialog`, dialog store 'group-details' with `{ kind, id }`), shown in
  the library info card and carried between placed and saved copies. New groups are named from their contents
  (`smartGroupName`, e.g. "3-seat sofa & coffee table + 2 more"); saved groups still called "Group 3" are renamed
  the same way when the Groups tab opens.
- **Invisible room dividers** (wall style `separator`, `isDividerWall`): split one space into two rooms (own floor,
  ceiling, name) without building anything. Room faces inset them by 0, so the two floors meet on the centre line;
  the wall network leaves them out of junctions (built walls mitre as if they were not there, no hubs); no body or
  extras in 3D, no 3D length labels, no walkthrough collision, no wall dimensions, not counted in wall totals; a
  dashed centre line in the plan (DXF layer A-AREA-SEPR). `addOpening` refuses them and `setWallStyle` removes
  their openings and keeps them ≤ 5 cm. Build panel preset "Invisible room divider"; Inspector shows no finishes.
- **Wall types** (`WallTypes.tsx`): walls grouped by role (exterior, interior, partition) with dividers apart. The
  Project panel lists each type with its common thickness and height and an "Edit all" button; a wall's Inspector
  has "Edit all N … walls". Both select the walls so the multi-wall editor changes thickness, height, base, type,
  style and, through the `walls-side` material target, each face's material for all of them.
- **See-through patterns** (`TexturePattern.cutout`, pack `PackPattern.cutout`): the tile draws only the solid parts and
  leaves the rest transparent (wire mesh, chair mesh, lattice). The material registry renders such materials
  transparent, double-sided, without depth writes and with a small alpha test; contrast blending keeps the holes.
  Use them for cage panels, crate mesh and mesh chair backs instead of hundreds of rods (MAX_PARTS is 160).
- **Pets** room category and type (`pets` pack: modular wire bird cage with see-through panels, dome cage, play
  stand, lovebirds, dog beds and crates, kennel, pen, gate, cat tree, litter cabinet, wall steps, fountain, carrier,
  sleeping cat…) and the `workspace` pack (desks incl. L, U, standing, wall-mounted; desk chairs incl. mesh, task,
  executive, drafting, kneeling; a desk set). Ready-made "Pet corners" and desk setups use them.
- Typecheck with `npm run typecheck` (`tsc -b`): the root tsconfig is solution-style, so `tsc --noEmit -p .`
  checks nothing.
- Wall construction style goes through `setWallStyle` (walls.ts): railings and half walls lower a room-height wall to
  1.05 m and remember `fullHeight`; switching back to solid or glass restores it (default wall height if unknown).
- Placing an item happens on pointer-down; `keepPlacedSelection` (placeTools) swallows the click that follows, so the
  3D view's click-to-pick does not select a wall or object under the cursor instead of the new item.

## 10. 2D editor (src/features/plan-2d)

- `PlanCanvas`: SVG with a world-unit `viewBox`; camera `{cx, cy, zoom px/m}`; wheel zooms about the cursor,
  Space/middle-drag pans, two-finger pinch on touch.
- **Fit**: `fit()` reads the live container rect, subtracts the floating panels with `floatingInsets` (top bar,
  tool rail, library, 3D view panel, inspector, status bar) and centres the plan bounds in the free area with an
  adaptive margin. When a project opens it fits immediately and again at 120/400/900 ms while panels mount,
  unless the user has already wheeled or pressed on the canvas (`userMoved`).
- `PlanDrawing` is **pure** (props: project, derived, options incl. `px` = world size of a screen pixel or print
  unit) and is reused by sheets and thumbnails. Layers: floors → furniture → walls (fills + face edges only, so
  junctions have no seams) → openings → labels → dimensions. Ceiling-mounted items and anything with elevation
  ≥ 1.2 m (`OVERHEAD_ELEVATION`) draw as **dashed overhead outlines**.
- Tools implement `Tool` (`tools/types.ts`) and receive a `ToolEnv` (project/derived getters, `px`, `tol`, `snap`,
  overlay setter, hint/cursor). Overlays are plain data (`ToolOverlay`) rendered by the canvas (SVG) **or** by the
  3D bridge. Keyboard: the active tool gets first refusal via `planKeyRouter`, then `useShortcuts`.
- Typed lengths while drawing walls (`3.5`, `350cm`, `11'6"` + Enter) and room sizes (`4x3`).

### Groups, right-click menus and browser keys

- **Groups**:
  - Model: `PlacedObject.groupId` plus `Project.groups` (`{ id, name }`, default `{}`, so older files load).
  - Commands in entities.ts: `groupObjects`, `ungroupObjects`, `renameGroup`, `pruneGroups` (groups of fewer
    than two members are dropped, e.g. after deleting) and `withGroupMates`. `duplicateEntities` gives copies a
    new group.
  - Selection: `features/editor/groups.ts` installs `setSelectionExpander` into the editor store, so
    `setSelection` widens to whole groups and `toggleSelection` toggles a whole group. Marquee, 2D clicks, 3D
    picks and menus all get this for free.
  - Moving: the 2D drag moves the whole selection, and the 3D body-drag moves group mates too (no wall hug for a
    group).
  - Shortcuts: Ctrl+G groups, Ctrl+Shift+G ungroups.
- **Saved groups**:
  - Right-click → "Save to library as a group" stores relative positions, sizes, finishes and copies of
    project-only materials in prefs (`savedGroups`, every project).
  - Furniture → "Saved groups" (`features/library/SavedGroups.tsx`) shows footprint previews. Click places the
    group in view; drag uses the asset drag channel with id `savedgroup:<id>`, handled in `useDropAsset`.
    Placing creates a new group.
- **Right-click menus**:
  - Plan: `plan-2d/contextMenu.ts` builds the items, adding Group, Ungroup, Rename group and Save to library.
  - 3D: every `onPick` site in SceneContent also fires on `contextmenu`. Scene3DView opens the same menu, or the
    empty-space menu, and ignores the click after a right-drag orbit or pan.
  - Library: asset cards offer Place, Place in view and Favourite; saved-group cards offer Place, Rename and Delete.
  - App.tsx suppresses the browser's own menu except in text fields (`.allow-native-menu` opts out).
- **Alt**: App.tsx blocks the browser default for Alt (menu focus) and for Alt+←/→/Home (history navigation).
  `altKey` still reaches pointer handlers, so Alt keeps disabling snapping.
- **Ceiling filter**: the special `render.hiddenCategories` entry `ceiling` (`CEILING_CATEGORY`, the dashed
  "Ceiling" chip) hides ceiling-mounted items in every room. `isAssetHidden` applies it in 3D, the plan and the
  guest view. Their lights keep shining because `LampLights` reads every object.
- **Door and window finishes** (`domain/model/openingFinishes.ts`):
  - Finish sets: 12 for doors (frame + leaf, e.g. oak, walnut, teak, gỗ lim, gỗ hương, laminates, paints) and 9 for
    windows (frame only: uPVC, aluminium incl. Xingfa champagne and wood-grain, steel, bronze, timber).
  - `applyOpeningFinish` keeps glass leaves.
  - UI: swatches in the Inspector (`OpeningFinishes`, applies to all selected openings of the family) and in the
    Build panel (for the next opening placed: `editor.doorFinish/windowFinish`).
  - Placing: the Build panel's Doors / Windows sections hold the type cards, then design and finish
    (`library/OpeningBuildOptions.tsx`): browse, pick a design, place. Change them later in the Inspector. The
    Inspector's "Door & window tool" panel only shows on mobile, where the Build panel is hidden.
- **3D view settings panel** starts closed (`editor.viewPanelOpen` defaults to false). The top-bar button or P opens it.
  - Users save their own under prefs `assetVariants['@door' | '@window']`.
- **Library card size**: three densities (Large / Medium / Small), from prefs `libraryDensity` and the header
  button, through `data-density` CSS.
- **Hover card variants**: picking a variant also arms the place tool with that item. The card stays open.

### Walls: styles, trims, slopes and drawing tools
- **Curved wall handles**:
  - Model: `WallSegment.curve` alone is a quadratic Bézier (one bend handle, drawn on the curve's midpoint). Adding
    `curveEnd` makes it a cubic: `curve` sets the start tangent and `curveEnd` the end tangent.
  - `buildWallPath(a, b, curve, curveEnd)` samples both kinds (`WallPath.control2`).
  - Commands that keep both handles: split (de Casteljau), node moves, length changes and reversal (`flipWall` swaps
    the handles). `updateWalls({ curve: null })` clears both.
  - Commands in walls.ts:
    - `joinTangent` gives the direction of the wall joined at an end.
    - `fitCurveToJoins` makes the curve tangent at both ends. One handle goes to the corner where the joined walls'
      lines meet; two handles get circle-sized lengths, so two perpendicular walls get a quarter round.
    - `setCurveHandles` converts exactly between one and two handles.
    - `makeCircularArc` gives a true round arc through the ends and the current peak.
    - `setCurveHandleFraction` / `curveHandleFraction` set and read both handle lengths as a fraction of the span.
    - `flipCurve` mirrors the bulge across the chord.
  - Inspector → Curve: Fit to joined walls, Two handles / One handle, Circular arc, Flip bulge, and a handle-length
    (top fullness) slider.
  - Dragging snaps: the bend handle to the tangent fit; an end handle to the joined wall's direction and 45° steps.
    Alt drags freely.
- **Glass walls and railings** have no left/right faces: their Finishes section shows only Glazing (or Bars) and
  Frame & mullions (or Posts & handrail), via `WallExtras.LightWallFinishes` / `isLightWall`. The two-sided slots,
  wall presets and per-face trims are hidden for them.
- **Schema** (all optional, so old projects are unchanged):
  - `WallSegment.style`: 'solid' | 'half' | 'glass' | 'railing-glass' | 'railing-bars'.
  - `heightEnd`: the height at node b; `height` applies at node a, which makes a sloped top.
  - `styleMaterialId`: the glazing or infill material; frames, posts and the half-wall cap use `materials.top`.
  - `finishes.{left,right}`: `{ skirting, cornice, rail, band }` (`WallTrim` / `WallRail` / `WallBand`).
- **Geometry** (`walls.ts`):
  - `WallGeometry.topAt(s)` gives the top height along the wall; `sloped` is true for sloped walls.
  - `edge(s0, s1, side)` returns a face polyline with mitred end corners.
  - Opening heads are kept below a sloped top.
  - `splitWallAt` keeps the slope line, and `flipWall` swaps the end heights and the finishes.
- **3D:**
  - `buildWallGeometry` follows sloped tops and returns null for glass walls and railings, which have no solid body.
  - `scene-3d/wallExtras.ts` builds everything else: face layers run between lo(s) and hi(s) and are interrupted where an opening's gap overlaps their height. It also builds the half-wall cap, the glass wall (rails, posts, mullions about every 1.2 m, glazing) and the railings (posts about every 1.4 m, handrail, glass panels or 11 cm bars). The output is one mesh per material, keyed by `wallExtrasKey`, and `SceneContent` › `WallExtrasNode` and the GLB export both use it.
- **2D:** glass walls and railings draw as a thin outline, a centre line and post/mullion ticks; half walls are drawn lighter.
- **Materials:** `MaterialTarget` gains `wall-trim` {wallId, side, part} and `wall-style` {wallId}, so trims and infill take part in linked edits and usage.
- **Presets:** `domain/model/wallPresets.ts` (`WALL_PRESETS`):
  - Build-tab "Wall types" cards set `editor.wallPreset`.
  - `drawingWallOptions()` in drawTools applies the preset.
  - The Inspector can apply a preset to selected walls (`WallPresetPicker`) or draw with one (`DrawPresetSelect`).
- **Inspector:**
  - `WallExtras.tsx`: `WallConstruction` (style, infill, sloped top) and `WallTrims` (per-face toggles and sizes).
  - `WallMultiEdit.tsx`: edits several walls at once.
  - `WallToolExtras.tsx` › `WallReferencePicker`: draw along the centreline or a face.
- **Drawing tools:**
  - **Draw by face:** `wallReference` 'left' | 'right' offsets the drawn polyline by half the thickness (`domain/geometry/drafting.ts` › `offsetPolyline`). Already-joined nodes never move.
  - **Curves:** the curve tool defaults to three-point arcs (control `2P − (A+B)/2`); `A` switches to free bend, and typed input sets the chord and the bulge.
  - **Extend/trim/join tool** (`E`, `tools/extendTool.ts`, commands in `domain/commands/wallTools.ts`): extend a free end to the next wall, trim an overhang, or join two collinear walls.
  - **Clear distance:** `F` in the measure tool measures from a wall face to the opposite parallel face.

### Doors, windows & passages
- **Kinds:** door-single, door-double, door-french, door-sliding, door-pocket, door-bifold, door-barn and door-pivot; passage, passage-arched and passage-moon; window-single, window-double, window-fixed, window-sliding, window-tall, window-arched and window-round. `isPassageKind()` and `isDoorKind` cover the passages.
- **Options:** `transom`, `threshold`, `casing`, `grille` ('none' | 'bars' | 'grid') and `shutters`.
- **Designs** (`domain/model/openingDesigns.ts`): the kind says how an opening works, the optional `Opening.design` says
  what it looks like. 18 door designs (flush, shaker, two/five panels, V-groove, lined, reeded, plank, louvred,
  half/side/three/full lite, divided lites, ribbed glass, slim aluminium clear/frosted, steel grid) and 12 window
  designs (`win-*`: plain, slim, black steel, tilt & turn, top light, asymmetric, 2×2 / 3×2 grid, vertical/horizontal
  bars, frosted lower, reeded glass).
  - `designFitsKind`/`designsForKind` decide what is offered: door designs for door kinds, window designs for windows,
    nothing for passages; French doors take glazed designs only; arched/round windows skip layouts that need a
    rectangle (top light, asymmetric, bars…).
  - No design = `defaultDesign(kind, style)`, which reproduces the pre-design looks ('panel' → two panels, barn +
    'panel' → braced plank, 'glazed' → full lite, French → divided lites, sliding non-flush → full lite). So old
    projects load and look the same; `style` stays and is kept in step with the design (`designPatch`).
  - Unknown design values load as "no design" (`.catch(undefined)`), so a newer file never fails in an older build.
  - Door leaves: `doorLeafLayout` gives regions (recess, groove, lite, void) plus bars, flutes, louvres and ledges;
    `leafCells` tiles the leaf into same-type rectangles, which the builder turns into boxes at full/recessed/
    grooved depth or glass. Window designs: `windowSpec` (frame/sash profile, top light, mullion, handle) and
    `sashGlazing` (bars, frosted pane per sash). Reeds and louvres are cached merged geometries.
  - Choosing a design applies its suggested material (`metal-anthracite`, `metal-black-matte`, `plastic-upvc-white`)
    to the leaf (doors) or frame (windows) and restores the default when leaving it (`setOpeningDesign`). Door glass
    is `glass-clear` / `glass-frosted` / `glass-reeded`; windows glaze with their panel material.
  - UI: `editor/OpeningDesignPicker.tsx` draws each design as a small SVG elevation from the same layout data. It is
    used in the Inspector's "Design" section and the Door & window tool panel (`editor.doorDesign` / `windowDesign`
    are applied on insert).
- **Exterior convention:** sashes open outward, so the exterior is the **swing side**. Shutters and bars go there, and the interior sill board is on the other side.
- **3D** (`scene-3d/openingBuilder.ts`):
  - The wall gap stays rectangular. Arched and round shapes fill the corners with **infill** prisms in the wall's own materials, named `opening-infill`, but only in solid or half walls. Wall materials are part of `OpeningNode`'s key, so repainting a wall updates the infill.
  - Pocket doors slide into the wall, and barn doors hang on a face-mounted rail.
  - For sliding kinds, `openAngle` 0–90 means 0–100 % open; the Inspector shows a percentage.
- **2D:** `symbols.ts` draws every kind.
- **Inspector:** `OpeningExtras.tsx` adds a "Details" section with the options.
- **Build tab:** `features/library/BuildExtras.tsx` provides `DOOR_KINDS`, `WINDOW_KINDS`, the icons and `WallPresetCards`.

## 11. 3D (src/features/scene-3d, walkthrough)

- `builders.ts` is the only place that turns the model into three.js objects: wall geometry with 3 material
  groups (left, right, top/ends/reveals), hubs, floor/ceiling slabs (ceilings face down so they never block
  top views), door/window assemblies (frames, leaves with swing, sashes, glass, handles), objects from parts
  (cached geometries flagged `userData.cached`, metre-based UVs), imported GLBs normalised to object size.
- `MaterialRegistry` keeps **one three.js material per material id**, updated in place → editing a shared
  material updates every linked surface without rebuilding meshes.
- `SceneContent` memoises per wall (geometry key string), per object (record identity), per opening. Wall display
  modes: full / cutaway (geometry cut at height) / fade (near walls swap to translucent clones) / hidden. In
  cutaway, door/window assemblies use cached **clipped material copies** (`clippingPlanes` at the cut height,
  `gl.localClippingEnabled = true` in `Lighting`) so frames and glass never poke above the cut walls.
- `Scene3DView`: R3F `Canvas`, perspective/orthographic camera switch, OrbitControls, lighting (RoomEnvironment
  PMREM + hemisphere + time-of-day sun with shadows; lamp lights from `LampLights`), view panel (saved views,
  walls, quality & light, categories). On desktop the panel can be stashed (header button or `P`) and brought
  back with the **View** button the tool rail shows in 3D; mobile only collapses it (there is no rail there).
- **Lamp lights** (`LampLights.tsx`, `data/assets/lights.ts`): `resolveObjectLights` turns an asset's `light`
  (point/spot, x/y/z offset, `heads`) into world-space lights that scale, mirror and turn with the object. The
  scene mounts a pool per quality, no bigger than the number of fixtures (`LAMP_BUDGET`: Balanced 4 point + 3
  spot, High 8 + 6 with 2 spot shadows, Ultra 16 + 12 with 4 spot + 2 point shadows and no range cut-off)
  and hands it to the fixtures nearest the camera's focus each frame. Never mount or unmount lights per lamp:
  a change in light count recompiles every shader. Idle pool lights sit at intensity 0. Spot shadow maps use
  `autoUpdate = false` and redraw only when the scene or the assignment changes.
- **Camera framing**:
  - `cameraViews.namedView` builds home/perspective (with `fitSphere`: plan bounding sphere + view direction),
    top/iso (with `fitOrtho`) and front views.
  - `CameraDirector` applies view requests from `useFrame` once the active camera and rebuilt controls match. It
    computes the fit distance from the **free area's** effective half-FOV. For a short settle window after a
    fitted view (1.2 s on open), it re-fits when the panel insets change, until the user grabs the camera.
  - `FreeAreaOffset` sets `camera.setViewOffset` so the projection centre sits in the middle of the area not
    covered by panels (like map padding). It eases when panels open or close. The orbit pivot therefore stays on
    the model while the model is framed beside the panels. Captures clear the offset on their camera clone.
  - The editor always opens on the fitted home view. `guest.startCameraId` is used only by Guest View and the
    guest export.
- **3D editing** (`edit3d.tsx`): `ToolBridge3D` runs the 2D tools in 3D by projecting the pointer onto the floor
  (or wall surfaces for openings/splits) — same snapping, typed input, commands, undo. Previews are 3D
  (translucent wall prisms, the real furniture model as a ghost, opening boxes, split planes, Html labels).
  Selecting: left-drag orbits, middle- or right-drag pans, the wheel zooms. While a drafting tool is active, left
  button belongs to the tool; orbit is right-drag, pan middle-drag.
  `TransformGizmo`: X/Z arrows (slide), Y arrow (elevation, 5 cm steps), centre disc (free floor move), ring
  (rotate, 15° steps; Alt = free). Grid-snapped, live readouts, one undo step per drag. Furniture body drag also
  works (with wall hugging). Library drag-and-drop works onto the 3D canvas.
- **Path tracing** (`pathTrace.ts › renderPathTraced`): clones the `neest-plan` group without helpers/sprites,
  adds a ground disc, a gradient sky (`GradientEquirectTexture`), the sun and up to 24 lamp lights (point and spot, nearest the camera), and
  renders with `WebGLPathTracer` (three-gpu-pathtracer 0.0.23, tiles 2×2) from a clone of the live camera.
  Progressive samples with progress/ETA, a live preview canvas, Stop & keep, and Cancel (`AbortSignal`).
  Frames are yielded with `MessageChannel`, not rAF, so rendering continues in background tabs. BVH is built
  synchronously (`setScene`); `setSceneAsync` needs a BVH worker. All GPU resources are disposed defensively.
- Walkthrough: pointer-lock mouse look + WASD/Shift, touch joystick + drag-look, eye height 1.6 m, collisions.
- Guest view (`#/guest/:id`) is view-only; the exported guest HTML embeds a GLB + the standalone runtime.

## 12. Library & materials

- **Assets** (`data/assets`): 270 procedural assets, one module per room. Each has:
  - a stable id
  - **category** (room: living, bedroom, kids, dining, kitchen, bathroom, laundry, office, hobbies, outdoor, storage, lighting, decor, plants, electronics, people, construction, generic)
  - **type** (what it is: seating, beds, surfaces, storage, appliances, plumbing, lighting, decor, plants, electronics, activities, kids, people, structure, misc)
  - optional `variants` (hand-made colour variants that replace the automatic themes), `model` (a shipped GLB, see
    "People and shipped models") and `variantOf` (a with/without-props version of another item, listed right after it)
  - **group** (shelf name; must be one of `ASSET_GROUPS[type]` in catalog.ts)
  - tags, default/min/max size, resizable flags, mount (floor/wall/ceiling) and default elevation
  - material slots with catalogue defaults
  - `build(size) → Part[]`, plus optional `planDetail`, `light` and `wallSnap`

  2D footprints are **derived** from the convex hulls of the parts with `plan !== false`, drawn by height.

  Add assets with the helpers in `parts.ts`:
  - primitives: `box`, `span`, `cyl`, `rod`, `lathe`, `prism`, `legs4`, `fronts`, `defineAsset`, …
  - detail helpers: `cushion`, `pillow`, `tufts`, `turnedLeg`, `slats`, `shakerFront`, `barPull`, `knob`, `frame4`, `bookRow`, `leaf`, `foliage`, `blobCluster`, `pot`, `rodPath`, `arcPoints`, `drapeFolds`, `rng`

  `assetChecks.ts › describeAssetChecks(list)` holds the per-asset validation. It checks bounds at default/min/max and every size corner, parts ≤ `MAX_PARTS` (160), slots, materials, light rules and type/group. `catalog.test.ts` runs it over the whole catalogue and adds catalogue-level checks plus parametric tests (bed pillows, sofa arms, table legs, wall-cabinet height).
- **Rendering detail cheaply**: `builders.ts › assetSlotGeometries(asset, size)` bakes every part into object space and merges them into **one geometry per material slot**. The result is cached per asset+size and shared by all instances (`userData.cached`: never dispose). A 120-part sofa therefore costs 2–4 draw calls. Thumbnails use the same path.
- **Library UI** (`features/library/LibraryPanel.tsx`): Sims buy-mode browsing.
  - **By room** (categories) or **By type** (types), with chips per room or type.
  - Listings are split into shelves: per room or type in "All", otherwise per group, ordered by `ASSET_GROUPS` and `groupRank`.
  - Search matches name, tags, room, type, group and pack name.

### Asset rules (for anyone adding content: people and agents)

`src/data/assets/assetRules.test.ts` enforces these rules. `plantInfo.test.ts`, `catalog.test.ts` (`describeAssetChecks`) and
`src/packs/packs.test.ts` cover the rest. Break one and `npm test` fails with a message that names the item.

1. **Where:** new content goes in a pack (`packs/<id>.pack.ts`, one file per collection). Edit the built-in modules
   only to fix or improve existing items. **Never rename or remove an item id**: saved projects and samples refer to it.
2. **Identity:** ids are lowercase kebab-case. Choose `category` (room), `type` (what it is) and `group` (a shelf
   from `ASSET_GROUPS[type]`). Make the name specific ("Oak slatted bench", not "Bench 2"). Names must be unique within
   a room.
3. **Text:** every new item needs a `description` (one or two sentences, 20+ characters, saying what it looks like and
   what it is made of) and 3+ distinct `tags` (synonyms, styles, and Vietnamese names when they are common).
   Older items without a description are frozen in `legacyNoDescription.json`. That list may only shrink: when you
   describe one of them, remove its id from the file.
4. **Size:** `defaultSize` is a typical real product in metres, with realistic `minSize`/`maxSize`. Parts stay
   inside the size box at every size, with 160 parts at most. Mark small details `plan: false`.
5. **Slots:** 1–4 slots, labelled by what they are ("Frame", "Seat cushions", "Leaves", "Pot"). Each default is a
   catalogue material of the right kind. Colour variants come from the label and the default material's family
   (`variants.ts`), so a slot called "Fabric" with a wood default gets wrong variants. Check the swatches in the hover card.
6. **Plants (all vegetation, cut or dried flowers, moss, terrariums, planted planters):**
   - Use `category: 'plants'`, `type: 'plants'` and a Plants shelf.
   - Set `plant: PLANT_SPECIES['<id>']`. If the species is missing, add a full guide to `plantSpecies.ts` first;
     `checkPlantInfo` validates it.
   - Cut, dried and preserved items need `form` and `vaseLife`.
   - Name the actual species or cultivar ("Peace lily 'Sensation'"), not "Potted plant".
   - Plant info is never allowed outside Plants, and plant-named items must be in Plants.
7. **Branded items:**
   - Only real models sold in Vietnam.
   - Set `brand: { name, model, line?, url, specs }` with the exact model number.
   - The item name includes the maker.
   - Put them in a `branded-*.pack.ts` file. Every item in such a file must carry `brand`.
   - Any item whose name mentions a known brand must carry `brand`.
   - Branded items get no automatic colour variants and users cannot save their own. When the maker sells several
     finishes (white/black fan, grey/silver vacuum), list them as hand-made `variants`; only those are offered.
8. **Materials:**
   - Procedural patterns tile seamlessly and stay near-white unless `colored`.
   - Photo sets go in `photoSets.json` + `PHOTOS`, then `npm run textures`. Stay under 60 MB, and every set must be used.
9. **Thumbnails:**
   - After adding or changing items or materials, run `npm run thumbs` and keep the files it writes:
     `public/thumbs/` for items, `public/swatches/` for textured materials. Then the library never renders while
     browsing.
   - The tests fail when an item or textured material has no shipped file.
   - Stale files are harmless: the fingerprint no longer matches, so the app renders that one at runtime. Re-run anyway.
10. **People:** figures go in `packs/people.pack.ts` (category/type `people`) with a pose from `HUMAN_POSES` (or a new
    one there) and outfit `variants`. After adding or changing a figure, run `npm run people` (bakes the realistic GLB)
    and then `npm run thumbs`. `people.test.ts` fails when a figure has no model or a stale hash.
11. **Versions of an item** (with or without props) are separate items with `variantOf`. See `packs/model-variants.pack.ts`.
   - The test checks presence only. Fingerprints computed in Node differ from the browser's, because the SSR
     transform rewrites pattern code.

### People and shipped models

- **People pack** (`packs/people.pack.ts`, category/type `people`, 39 figures): Asian sizing first. Vietnamese
  adults are 1.56 m / 1.68 m and other East Asian adults 1.58–1.74 m; the pack also has taller and shorter adults,
  seniors, teenagers, and children of 2, 5, 7 and 10. Six skin tones. The poses cover standing, walking, phone,
  arms crossed, hands on hips, waving, chair, desk, eating with a rice bowl, sofa, cross-legged, seiza, hugging
  knees, squat, lying on the back, side and front, cooking, chopping, washing up, reaching up, mirror and
  stretching. Hand-made outfit `variants` change the top and bottoms. Sitting figures state the seat height
  they fit.
- **Pose system** (`data/assets/humanParts.ts`, in the kit):
  - `HumanPose` is joint angles: body pitch/roll/yaw, torso lean/tilt/twist, head, and per limb
    flex/abd/turn/bend/ankle, with shin/foot overrides for folded legs.
  - `humanPoseTargets(pose)` turns a pose into frames and unit segment directions.
  - `humanFigure(body, pose)` builds the procedural figure from anthropometric proportions (Drillis & Contini).
  - `HUMAN_POSES` holds the ready poses.
- **Realistic figures** (`npm run people` = `tools/bake-people.mjs` + `src/devtools/peopleBake.ts` in headless
  Chromium):
  - Sources: the CC0 Quaternius Ultimate Modular Men/Women GLBs (shared 62-bone rig; meshopt copies from
    github.com/nikitapage10/models), downloaded once into the OS temp folder.
  - The bake measures stature in a straightened standing pose, scales to the figure's stature (children: head
    bone scaled up, legs down), and aims each bone along `humanPoseTargets`.
  - Aiming uses rest-pose local segment directions. The feet are IK-style bones parented to the root, so they
    are placed at the end of the shins. Forearms are twisted so palms face down or inward.
  - Materials map to slots: skin, hair (also brows and eyes), top (main body material), accent (other body
    materials), bottoms, shoes.
  - Output: positions + indices only, standing on y = 0 and centred, written to
    `public/models/people/<id>.glb` (7 MB in all) and `src/data/assets/peopleModels.json` (file, sha1 hash,
    size, seat height, slots; exported by the kit as `PEOPLE_MODELS`).
  - `people.test.ts` checks that every figure has a model and that the hashes match the files.
- **Shipped models at runtime** (`features/scene-3d/assetModels.ts`):
  - `assetSlotGeometries` uses an asset's `model` once it has loaded. The model gets smooth normals and
    box-projected UVs in metres, and is fitted uniformly into the box. Until then, and whenever the file is
    missing (tests, offline before first use), the procedural `build` is shown.
  - `build` also always gives the 2D footprint.
  - `ObjectNode` re-renders on `useAssetModelsVersion`. The hover preview, thumbnails and exports call
    `loadAssetModel` / `preloadAssetModels` first.
  - The thumbnail fingerprint includes the model hash.
  - The asset checks allow 6 slots for people (shoes and outfit details).
- **Model variants** (`packs/model-variants.pack.ts`):
  - Empty versions of dressed furniture drop prop slots: a bookcase without books, cabinets without china.
  - Styled versions add props on bare furniture: tables set for dinner, a sideboard with a lamp and vases, a
    worktop with jars. They build the base lower than their box and keep props inside with `containParts`.
  - Both use `builtInAsset(id)` from the kit and set `variantOf`. `LibraryPanel.besideBase` lists them right
    after the original.
- **Sofas** (`packs/sofas.pack.ts`, 17): one parametric builder (arms, backs, bases, chaise, recliner, floor sofa)
  plus a curved sofa, each with hand-made finish variants.
- **Kitchen counters** (`packs/kitchen-counters.pack.ts`, 28): a counter is a row of bays (door, doors, drawers,
  open, pull-out, oven, dishwasher, hob, sinks). The worktop is cut into strips around the sink openings, and bowls
  hang in them (inset rim, undermount or apron).
  - Items: base units, runs from 1.8 to 3 m, a Vietnamese tiled masonry counter (bếp xây), islands, a peninsula,
    and eight sink units including a stainless sink with drainer.
  - Sink units include the tap in their height.
- **Structures** (`packs/structures.pack.ts`, 54, type `structure`): placeable building parts on all five structure
  shelves. The front faces +z, wall items stand on -z, and staircases climb from +z towards -z.
  - Local helpers: `panelXY`/`panelZY` (prisms in the front or side plane), `bar` (a box between two points),
    `arcBand` (arch mouldings) and `band` (a sloped strip clipped to the floor and the top).
  - A `Flight` kit (`steps`, `stairString`, `balusters`, `handrail`, `newel`, `treadLines`) builds straight, L and U
    stairs. Rails and strings stop at the item height, as if they continue into the upper floor.
  - Stairs draw riser lines and an arrow in plan (`planDetail`).

### Model variants (filled / empty …) and collections

- **Model variants** (`AssetDefinition.models`, `src/data/assets/models.ts`): the same item with different contents —
  a bookcase Filled or Empty, a table bare or set for dinner. Unlike colour variants they change parts, not materials;
  unlike `variantOf` versions they keep one item, one size and one outline. The first model is the default; a placed
  item stores a non-default one in `PlacedObject.model` (optional; absent = default, unknown ids fall back).
  - A model can `hide` slots of the item's own parts and/or add `props(size)` (with its own `slots`). Props are forced
    to `plan: false`, may rise above the item's box (up to `PROPS_ABOVE` = 1 m, e.g. a lamp on a sideboard) but must
    stay inside its footprint. Size, outline, collisions and dimensions never depend on the model.
  - `withModel(asset, id)` returns the asset as that model builds it (derived id `<id>@model:<model>`, memoised per
    asset object, dropped on pack reload). Every geometry user goes through `getObjectAsset(project, obj)`: 3D build,
    plan symbols, DXF, report, Inspector finishes, ghosts, saved-group thumbnails. Slot defaults of model-only slots
    resolve through `slotDefaultMaterial`.
  - Packs: items list `models`; a pack can also add models to other items with `PackSpec.models` ({ assetId:
    { original, models } }) — the unmodified item becomes the first model under the `original` name (`model-variants`
    pack does this for 27 built-ins). Pack items here use a `filled()` / `filledVanity()` helper: contents are marked
    with `F()` (or sit in fill slots) and become the default "Filled" model's props, with an "Empty" model beside it.
  - The old separate "…, empty" / "…, styled" items are retired: `RETIRED_MODEL_ITEMS` maps them to the original item
    and model (with `dh`, the height the old styled item added); `repairProject` upgrades placed items on load and
    saved/ready groups follow them via `currentItem`.
  - UI: a corner button on library cards (opens the model list), a small pill in the info card and the Inspector
    (`ModelPicker`, expands its list inline so the hover card stays open and the place tool stays armed). The library
    choice is `editorStore.modelChoice[assetId]`; thumbnails follow it (`npm run thumbs` renders every model).
  - Checks (`assetChecks.ts`): every model builds valid parts, its plan parts all come from the item's own build, props
    stay within the footprint and ≤ 1 m above it; built-ins extended by packs are checked in `packs.test.ts`.
- **Collections** (`Project.collections`, built in a parallel session): named lists of library items and groups
  (`savedgroup:<id>`), a top-level project field (not in `PLAN_KEYS`) so every option shares them and they sync with the
  project file. `groups` keeps copies of the user's own saved groups so they resolve on other machines. Commands in
  `domain/commands/collections.ts`, UI actions in `features/library/collections.ts`. The Furniture dropdown lists rooms
  or types, then "Groups" (`groups`), then each collection (`col:<id>`); the old Groups browse tab is gone. Card menus
  offer Add to / Remove from each collection.

### Content packs (`/packs`)
- **One file per pack**: `packs/<pack-id>.pack.ts` must `export default definePack({ name, version?, author?, description?, license?, items, materials?, patterns?, textures? })`. It imports everything it needs from `@/packs/kit`, which re-exports the asset helpers and types.
  - `packs/README.md` is the authoring guide.
  - `packs/_template.pack.ts` is a starting point. Files starting with `_` are ignored.
  - `packs/halloween.pack.ts` is a full example: 10 items, its own pattern, embedded bitmaps and glowing items.
- **Namespacing**: the pack id is the file name. Items become `<pack>:<id>`, and so do materials, patterns and photo sets. A pack's slot defaults and material patterns may name its own local ids, which `runtime.ts` rewrites. Built-ins never contain `:`, so `isPackId`/`dropPackKeys` (packs/events.ts) can find pack entries in any cache.
- **Textures**:
  - `materials[].pattern` uses a built-in pattern or the pack's own `patterns` (`draw(ctx, size, rand)`, seamless, near-white unless `colored`). These are registered via `setPackPatterns` in a map separate from the 28 built-ins; use `patternInfo` / `allPatternIds` rather than `TEXTURE_PATTERNS`.
  - `materials[].image` names entries of the pack's `textures` map (data URLs, so the pack stays one file). These register as photo sets via `setPackPhotoSets` with a neutral mean (gain 1: a white base colour shows the bitmap as painted).
- **Runtime** (`src/packs/runtime.ts › applyPacks`): removes everything a previous run added, then validates and merges packs into `ASSET_CATALOG`/`ASSETS_BY_ID` and `MATERIAL_CATALOG`/`_BY_ID`, **in place**. Problems are collected per pack (`installedPacks()[i].errors`) and logged; they are never fatal. A throwing `build()` renders as a plain box. Pack items carry `pack: { id, name, version, author }` and `source` "<Name> pack by <author>".
- **Live loading**:
  - `src/packs/loader.ts` (imported first in `main.tsx`) globs `/packs/*.pack.ts` eagerly and self-accepts HMR, so editing a pack re-runs it.
  - Vite does not re-run an eager glob when a matching file is *added or deleted*. `tools/neest-packs-plugin.ts` watches `/packs` and calls `server.reloadModule(loader)` for that case.
  - Each run calls `notifyPacksChanged()`. Caches drop pack entries: builders, plan footprints, thumbnails, `MaterialRegistry` textures, pattern canvases and photo images. `usePackVersion()` re-renders the library, `PlanCanvas` (drawOpts), `SceneContent` and each `ObjectNode`.
  - Verified in the browser: adding, editing and deleting pack files updates the open editor without a page reload.
- **Provenance**: library cards show a pack badge **only on hover** (plus the tooltip). The inspector of a placed item shows "From the <pack> pack v<version> by <author> · <licence>". A project item whose pack is missing renders as a placeholder, with a notice naming the pack.
- **Plant care guides** (`AssetDefinition.plant: PlantInfo`, types.ts): botanical name, family, light levels
  (`direct-sun | bright-indirect | medium | low`), spot (window distance), avoid (radiators, draughts), rooms, water
  (summer / winter / how to tell), humidity level, temperature (°C min/max/lowest), soil, repot, feed, mature height
  and spread (m), growth, pets (`safe` + note, ASPCA lists), difficulty, tip. `data/assets/plantInfo.ts` formats it
  (°F first for ft/in projects, friendly size ranges), builds library search words (botanical name, "low light",
  "pet safe", rooms) and validates it: `checkPlantInfo` runs in the pack loader, which drops a malformed guide and
  reports it. `features/library/PlantCare.tsx` renders it short (badges + five one-line rows: spot, water, temp,
  humidity, grows to) in the hover card; the Inspector adds a "More care details" toggle.
- **Plant geometry kit** (`data/assets/plantParts.ts`, re-exported by `@/packs/kit`): `bladeLeaf` (shaped outlines
  split into panels along the midrib: arch, twist, V-fold, slits, wavy/toothed margins, heart/arrow basal lobes),
  `pinnateFrond`, `palmateOutline`, `sprigOutline`, `planter` (terracotta, cylinder, taper, bowl, egg, footed,
  basket, cube, hanging), `plantStand`, `hangingCords`, `fitGroup`/`containParts` (keep every part in the box at
  any size). `leafPanel` does not re-centre outlines, so texture u = 0 stays on the midrib (leaf patterns draw it on
  the tile edge) and `along` continues the pattern across a blade's panels.
- **Colour variants** (`data/assets/variants.ts`): every slot is sorted into a family (wood, planks, painted, fabric,
  velvet, leather, metal, stone, pottery, plastic, rug, foliage, flower) from its label and default material, or kept
  fixed (glass, lights, screens, soil, sanitary ceramic, printed patterns, baskets…). Six themes (Natural, Dark, Light,
  Warm, Cool, Bold) pick one catalogue material per family (`FAMILY_THEMES`), so variants are coordinated sets;
  appliances use realistic metals only; plants vary only leaves (other greens: same leaf texture first, limited
  lightness jumps), flowers and pots. Branded and imported items get no themes and no saved user variants
  (`hasFixedFinish`); a branded item may list the maker's own finishes as hand-made `variants`. ~580 of ~675 items
  have variants. Users save their own from an edited item (Inspector → "Save as variant"): `UserVariant`s live in
  prefs (`assetVariants`, IndexedDB) and carry copies of project-only/edited materials; `prepareVariantMaterials`
  adds them under a new id when the target project already has a different material with that id.
  UI: `VariantSwatches` in the hover card (choice in `editor.variantChoice`, shown in the live preview and used by
  both placement paths via `features/library/variantChoice.ts`) and `editor/ObjectVariants.tsx` (apply to every
  selected item of the kind, save, delete saved ones).
- **Tests**: `src/packs/packs.test.ts` loads the real `/packs`, runs `describeAssetChecks` on every pack item, and checks namespacing, textures, reload replacement and the build fallback. Run it with `npx vitest run src/packs`.
- **Materials** (`data/materials/catalog.ts`): ≈230 materials in 12 categories (wallpapers sit in "Paint & wallpaper";
  no new category, so older builds still load projects); defaults in `DEFAULT_MATERIALS`. 45 procedural patterns
  (wallpapers incl. coloured tropical/floral, gạch bông cement tile, chevron/basketweave parquet, terracotta, fish-scale,
  penny, limewash, Venetian plaster, fluted, wood slats, cane webbing) and 55 CC0 photo sets (31 MB of the 60 MB budget).
  Two texture sources per material, same **texture × colour (multiply) model**:
  - **Procedural** (`texture`, `patterns.ts`): 28 seamless tiles drawn with wrap-around maths, deterministic seeds,
    normal maps derived by Sobel. Tiles are near-white luminance; `art`, `books`, `rug-geometric` are coloured.
    Detail layers: wood pore channels, ray flecks and figure, plank micro-bevels/end grain/wear, tile edge chips,
    pinholes and grout grime, brick spalls and recessed mortar, plaster pits and crazing, marble hair veins and
    sparkle, fabric fibres and pills, leather pores and creases. Always kept as the **fallback**.
  - **Photo** (`photo`, optional): CC0 PBR sets from ambientCG / Poly Haven listed in `photoSets.json` (39 sets,
    ≈26 MB in `public/textures/<set>/`: `color.webp` sRGB, `normal.webp` OpenGL, `roughness.webp`, `swatch.webp`
    256 px). `PHOTOS` in catalog.ts maps ~60 catalogue materials to sets (several share one set; the base colour
    tints it). `photo = { setId, scale m/tile, rotation°, contrast, enabled }`; `enabled: false` = use procedural.
  - **Colour normalisation**: `tools/fetch-textures.mjs` stores colour maps as near-neutral *variation* maps
    (luminance + a little of the photo's own chroma, less for saturated photos, scaled toward linear 0.6). At
    render time `MaterialRegistry` multiplies the base colour by `0.6 / meanLinear` per channel (manifest) and
    divides roughness by `meanRoughness`, so base colour and roughness mean the same with either source.
    (Per-channel normalisation of a raw saturated photo amplified its dim channels into streaks — fixed this way.)
  - **Loading / fallback** (`features/materials/photoTextures.ts`): the manifest (`textures/manifest.json`) is
    fetched once; images load lazily per set (`subscribePhotos` notifies). Until a set's maps have loaded or
    failed, and whenever the manifest/files are missing (static host without the folder, tests: MODE=test, jsdom),
    materials show the procedural texture. `MaterialRegistry` swaps maps **in place** on the shared material, so
    linked edits keep working; cutaway-clipped and faded wall copies follow their source via `followSource`
    (SceneContent). Library thumbnails await the photo sets used by furniture defaults (top-level await in
    `thumbnailRenderer.ts`, max 6 s; needs `esbuild.supported['top-level-await']` in vite.config).
  - **Older projects**: `migrateProject` gives catalogue copies with `photo` missing/null the catalogue's photo
    when their procedural pattern is unchanged (no schema bump). Switching to procedural stores `enabled: false`.
  - PWA: textures are not precached; Workbox runtime-caches `*.webp` (CacheFirst) and the manifest (NetworkFirst).
  - Refresh/extend: edit `photoSets.json` (+ `PHOTOS`), run `npm run textures` (`--force` re-encodes from the
    download cache in the OS temp dir, `--only a,b`, `--prune`). Bump `PIPELINE` in the script when processing
    changes. Tests (`photoTextures.test.ts`) check the mapping, manifest consistency and the < 60 MB budget.
- **Shipped swatches** (`features/materials/swatchFiles.ts`): `npm run thumbs` also writes one 96 px WebP per
  distinct swatch look to `public/swatches/`. Each file is keyed by a fingerprint of colour + pattern code + contrast,
  or photo set + crop + tint, not by material id, so project copies that look the same reuse it. The manifest maps
  fingerprint → file and catalogue id → fingerprint (the coverage index the tests read). `swatchBackground` uses a
  matching file first, then falls back to drawing at runtime. The manifest arriving triggers `notifyPhotos()`, so
  swatch components re-render.
- **Finish picker** (`MaterialSlotRow` → `FinishPicker`): on desktop a slot row opens `MaterialPanel`, a
  full-height floating panel docked left of the Inspector (`editor.materialPicker` = { key, label, target,
  fallbackId }; width shared via `--inspector-w`; listed in `floatingInsets`). A pick applies at once and the panel
  stays open; Esc, its close button, the same row, a selection change, collapsing the Inspector, walk mode or a
  hidden interface close it (the selection-change rule is a subscription in `editorStore.ts`). On mobile the same
  picker opens inline under the row and closes after a pick.
- Imported models: GLB or self-contained glTF ≤ 60 MB; stored as GLB blobs in IndexedDB; included in `.neest`,
  GLB and guest exports, and uploaded to `projects/assets/` when the project is mirrored to the repo.

## 13. Persistence & file formats

- Dexie DB `neest`: `projectMeta` (list view: name, timestamps, thumbnail SVG, counts, area), `projectDocs`
  (full project JSON), `blobs` (imported models), `prefs` (favourites/recents/onboarding). Theme also in
  `localStorage` (`neest.theme`) to avoid a flash before React mounts. `setThumbnail(id, svg)` updates only the
  stored preview.
- `.neest` = ZIP: `manifest.json` (`format: "neest"`, `formatVersion`, `schemaVersion`, asset list),
  `project.json`, `assets/<blobId>.glb`. Import validates magic bytes, sizes (250 MB file / 60 MB model), schema,
  references; id collisions get a new id and "(imported)" suffix. Plain project JSON also imports.
- Offline: production build registers a Workbox service worker (vite-plugin-pwa) precaching all chunks.

### Repo workspace (`projects/`)
- `tools/neest-workspace-plugin.ts` serves `/__neest/fs` on the dev **and** preview servers: `GET /health`,
  `GET /projects` (list), `GET|PUT|DELETE /projects/:id`, `GET|PUT /assets/:blobId`. Ids must match
  `^[A-Za-z0-9_-]{1,80}$`; limits 50 MB per project and 60 MB per model (GLB magic checked). Files are
  `projects/<name-slug>__<id>.json` (pretty JSON), written atomically (tmp + rename); a rename removes the old
  slug's file. `*.tmp` files are ignored by Vite's watcher.
- The plugin watches the folder and sends `neest:projects-changed {id, kind, file}` over Vite's HMR socket.
  Its own writes are remembered in `recentWrites` so they do not echo back.
- Client: `storage/workspace.ts` (`workspaceAvailable`, `listWorkspace`, `loadFromWorkspace`, `saveToWorkspace`
  (uploads model blobs first), `removeFromWorkspace`, `pullWorkspaceAssets`, `onWorkspaceChange` via
  `import.meta.hot.on`).
- `saveProject` and the autosave flush **mirror** to the repo when the `repoSync` pref is on (default). Status is
  shown in the save indicator (`useSaveStore.repo`: off/pending/synced/error).
- `loadProject(id)` prefers the repo copy when it is newer than the browser's (pulls its models, saves it
  locally) and reports `source: 'repo'` and `firstOpen`. The editor toasts "Opened from the repo folder" or
  "Loaded the newer copy from the repo".
- Live updates: an open editor applies a newer on-disk version with `applyExternal` (undoable "External change
  (repo folder)") and toasts. The launcher refreshes on any change. Repo-only projects are listed under
  "From the repo folder".
- Thumbnails: every card gets a plan preview. Stored previews are used when present. Otherwise
  `features/projects/thumbnails.ts` renders one on demand from the repo file (repo-only or newer-in-repo) or the
  local document, cached per id+version and rendered one at a time in idle time. Local results are stored back
  with `setThumbnail`.

## 14. Exports (src/features/exports)

| Output | How |
| --- | --- |
| Plan sheet SVG/PDF/PNG | `sheet.tsx › buildSheet`: paper A4/A3/A2/Letter/Tabloid, orientation, scale 1:20…1:200 or fit, title block, scale bar, legend/room schedule; units are **paper mm**; the plan is `PlanDrawing` scaled by `1000/N`; one drawing px = 0.22 mm keeps line weights legible. PDF via jsPDF + svg2pdf (vector; textures and halos disabled). PNG rasterises the SVG at a DPI (max 8192 px). |
| Plan image PNG | plan only at px/m, optional transparency |
| DXF | `dxf.ts`: AutoCAD R12 ASCII, 1:1 in mm/cm/m/in, Y flipped, layers A-WALL, A-DOOR, A-GLAZ, A-AREA, A-ANNO-TEXT, A-ANNO-DIMS (exploded lines + text), A-FURN |
| 3D render PNG (real-time) | `sceneRuntime.captureView`: renders the live scene with a clone of the live camera at the requested size (same position/orientation/vertical FOV, view offset cleared) |
| 3D render PNG (path traced) | Render dialog → engine "Path traced": `renderPathTraced` with samples 32/128/512/1024, bounces 3/5/8, optional transparent background (§11) |
| GLB | `sceneExport.ts`: standalone scene from the same builders → GLTFExporter (binary). The export registry bakes photo colour maps into canvases (1K for 2K floor sets, 512 px otherwise, JPEG in the GLB, colour gain folded in so glTF factors stay ≤ 1), skips normal/roughness maps, and awaits loads (`whenPhotosReady`); unavailable photos fall back to procedural |
| Guest walkthrough | `guestExport.ts`: one HTML file = inline viewer runtime (three.js included) + base64 GLB + cameras, spawn, colliders. No external URLs, blob URLs or storage access (photo textures are embedded in the GLB as above) |
| `.neest`, JSON summary | `neestFile.ts`, `report.ts` |

The Export dialog opens instantly: `EditorDialogs` renders the dialog frame at once with a `<Suspense>` fallback
(`PanelLoading`) and lazy-loads `ExportPanel`. The chunk is preloaded on hover/focus of the Export button and
2.5 s after the editor opens. The sheet preview uses `useDeferredValue`; its download button is disabled while
the preview is stale.

Filenames: `<project-slug>_<yyyy-mm-dd>_<output>.<ext>`. All exports are labelled planning drawings, not
construction documents.

## 15. Testing

- `npm test` (Vitest, jsdom): geometry (intersections, polygons, triangulation, Bézier, units), commands (chains,
  T-junctions, crossings, corridors, stubs, islands, L-rooms, splits, clamps, merge/heal, room identity),
  history (undo/redo, gesture collapsing), schema, sample projects (four samples; studio is exactly
  9 × 4.5 m with no colliding furniture), the **loft stress sample** (`loft.test.ts`: schema, curved walls,
  unclamped openings, four rooms ≈ 100 m², no error diagnostics, derive < 60 ms, DXF/sheet/report, mass
  edits with undo/redo), the **grand apartment sample** (`grandApartment.test.ts`: ten rooms ≈ 205 m², 28
  unclamped openings, 200+ items with no colliding or wall-crossing furniture, derive < 120 ms, exports, mass edits), asset catalogue (1224 checks), texture patterns (191 checks), plant info and houseplants pack, colour variants (every
  generated variant, foliage stays green, fixed slots, user variants, applying with carried materials), photo textures (set list, catalogue mapping, manifest/files/size budget, load-time photo fill, registry fallback). Canvas 2D is unavailable
  in jsdom — texture functions return `null` there by design.
- `npm run test:e2e` (Playwright, Chromium): smoke flows in `e2e/` against the dev server.
- Browser checks: use the dev hooks. For synthetic pointer events, compute coordinates with
  `getBoundingClientRect()`; `setPointerCapture` throws for synthetic pointer ids (guarded with try/catch).

## 16. Pitfalls already found (read before debugging!)

1. **R3F canvas stays blank / no WebGL root** on first mount of the lazily loaded 3D view: react-use-measure
   drops the ResizeObserver callback that arrives before its effects run, so the canvas is measured 0×0 and R3F
   never creates its root. Fix: `useCanvasMeasureFix()` dispatches window `resize` after mount. Keep it on every
   `<Canvas>` (guest page uses `<CanvasMeasureKick/>`).
2. **R3F picks the wrong objects inside CSS-scaled containers**: R3F's default pointer mapping uses
   `offsetX / size.width`, inconsistent under CSS `zoom`/`transform` (e.g. preview panes). Fix: Canvas
   `onCreated={(s) => s.setEvents({ compute: clientCompute })}` (client coords + canvas rect).
3. **Invisible meshes are not raycast by R3F.** Gizmo hit-targets use a visible material with
   `colorWrite:false, opacity:0` instead of `visible={false}`.
4. **Gizmo vs scene picking**: R3F delivers events nearest-first, so walls/furniture in front of a gizmo get the
   event first. Scene handlers call `hitsGizmo(e)` and bail out so the gizmo always wins.
5. **OrbitControls are recreated when the camera projection changes**; effects applying a view can hit the old
   instance. The `CameraDirector` applies pending views in `useFrame` once `controls.object === camera`.
   Do not pass `target` as a prop to drei `<OrbitControls>` (it resets every render).
6. **Don't frame by moving the orbit target sideways.** Shifting the target to dodge panels puts the orbit pivot
   off the model. Use the camera view offset (`FreeAreaOffset`) instead. Any code that clones the live camera
   for an output must call `clearViewOffset()` on the clone.
7. **WebGL screenshots are black** in tooling without `preserveDrawingBuffer`; it is enabled in dev only.
   Production captures use `captureView` (render + `toDataURL` in the same task).
8. **Hidden preview panes don't run rAF.** In tooling panes, `requestAnimationFrame` may not fire at all, so
   `useFrame` logic (camera director, view offset) does not run until a screenshot forces a frame. Tooling
   screenshots can also be cropped when `devicePixelRatio` ≠ 1. Trust in-page measurements
   (`camera.project`, `getBoundingClientRect`) over screenshots.
9. **Vite/HMR module duplication**: after HMR, modules load with `?t=` and deps with `?v=` hashes. Importing a
   module from the console with a different URL creates a second instance (e.g. a second `liveScene`).
   Do a full reload when debugging singletons; find dep URLs via `performance.getEntriesByType('resource')`.
10. **Lights/env maps and multiple renderers**: PMREM env textures belong to one renderer. Capture uses the live
    renderer; thumbnails/import previews create their own PMREM.
11. **three-gpu-pathtracer**: latest versions need three ≥ 0.185; this repo pins `0.0.23` (three 0.178). Its
    `setSceneAsync` throws "setBVHWorker must be called" without a worker. A failing init used to be hidden by a
    later "reading 'dispose'" error in cleanup, so cleanup is wrapped (`safely`) and the original error is logged.
12. **Fast Refresh** cannot hot-swap `.tsx` files that also export non-components (e.g. `edit3d.tsx` exports
    `TOOLS_3D`); Vite falls back to invalidation/full reload.
13. **Panel insets**: `floatingInsets` keeps a minimum free area by shrinking both sides **proportionally**. An
    earlier fixed 60 % cap trimmed only the right inset, which pushed fitted plans under the inspector.
14. **Repo sync echoes**: the plugin must record its own writes (`recentWrites`) or every save triggers a
    "changed on disk" round trip. `applyExternal` must not bump `revision`, or autosave writes the file back.
15. **Circular imports between samples**: sample builders share helpers via `sampleHelpers.ts`. Importing
    `demoProject.ts` from another sample file creates a cycle (`SAMPLES` references every builder).
16. **Cloned textures created before their image loads never upload** (three uploads only when
    `texture.version > 0`). Photo textures are therefore created only after the image has decoded, and
    materials switch over in `refreshPhotos`. Likewise any material *clone* (cutaway, fade) is a snapshot; keep
    it in step with `followSource` or it shows stale maps/colours.
17. **Global shader patches freeze the tab**: drei `SoftShadows` (PCSS) bakes its size into
    `ShaderChunk`, so every change recompiles every program. A "sun size" setting built on it (and a VSM
    variant) was reverted at the user's request; revisit soft sun shadows later with a uniform-driven approach.
18. **Shared repo files get rewritten by every open browser**: a browser running an older build saved
    `photo: null` into a repo project during development, which is why the load-time photo fill treats
    `null` like "not set".

- **3D first frame stalls for seconds**: it used to upload every texture at once (60LTN: ~115 textures, ~124 MP, mostly
  raw 2K photo sets × 3 maps). Live photo maps are now capped at 1K (`LIVE_PHOTO_MAX` in materialRegistry; exports bake
  their own sizes) and `FirstFrames` uploads textures in time-sliced batches after `compileAsync`. Dev builds log
  `[3d] ready: scene … · materials … · first frames …` and keep it in `window.__NEEST_LOAD__`.
- **Z-fighting (flickering coplanar faces)**: depth ties are settled per mesh with a constant polygon offset, switched on
  only during that mesh's own draw calls (`depthBias.ts`; materials are shared). Walls draw nearest (-6 units), so
  objects touching them lose; wall trim (glass frames, railings, mouldings) draws farther (+3, slope 1.5), so it loses
  to anything it runs into (a glass frame into a column); inside an item, smaller slots win over bigger ones (a grille
  over the body). Never a slope term on a mesh pulled nearer: it brings hidden end faces seen edge-on through the
  surface in front (the old hairline wall seams). Assets: `coplanar.ts` + the asset rule keep new items free of
  coplanar faces between slots (legacy offenders in `legacyCoplanar.json`, a list that may only shrink): lift the
  smaller part ~1 mm proud.
- **Something re-renders on every drag move**: the editor shell re-renders on each project change (pointer moves are
  store previews). Panels must subscribe to the slices they show and be memoised (`LibraryPanel` is `memo`; its cards
  must not read the whole project). Profile with a CDP CPU profile in headless Playwright with the UI showing.
- **A browser with an older copy of a project overwrites `projects/` when it opens it** (repo sync on). Before scripting
  edits to a project file, make sure no open tab holds a stale copy, or apply the change through the running app
  (`window.__NEEST__.project.getState().execute`) so it merges with the live state.
- **Hidden Browser pane pauses rendering**: rAF stops, so 3D loading never finishes there; measure in a headless
  Playwright page instead (repo sync off first).

## 17. Recipes

- **New tool**: implement `Tool` in `plan-2d/tools/`, register it in `PlanCanvas` and `ToolBridge3D` (if it works
  in 3D), add to `TOOLS` in `EditorShell` and `TOOL_SHORTCUTS`. Emit previews via `ToolOverlay` only.
- **New asset**: follow §12 "Asset rules": usually a pack file (`packs/README.md`) with `defineItem`; slot defaults
  must exist in the material catalogue; run `npx vitest run src/data/assets src/packs`, then `npm run thumbs`.
- **New material/pattern**: add to `catalog.ts`; new pattern ids must be implemented in `patterns.ts` (tests check).
- **New project setting**: add to `ProjectSettingsSchema` **with a default**, set it in `createEmptyProject`.
- **New export**: build from `Project` + `derivePlan` (+ `buildSheet`/builders); add a pane in `ExportPanel`;
  use `exportFilename` + `downloadBlob`. Anything that clones the live camera must clear its view offset.
- **New sample**: write a builder in its own file using commands and the helpers in `sampleHelpers.ts`
  (`wallAt`, `opening`, `placeFurniture`, `paintWallFacing`); add it to `SAMPLES` in `demoProject.ts`, and extend
  `samples.test.ts` (asset slot names must exist on the asset).
- **New floating panel**: add its selector to `components/layoutInsets.ts` so 2D fit and 3D framing avoid it.

## 18. Status & roadmap

Done and verified in the browser:
- Launcher: create, rename, duplicate, delete, import and export; three samples; repo-folder section; plan
  thumbnails for every card.
- 2D drafting: walls, curved walls, rooms, openings, split, measure, snapping, typed lengths, dimensions, two
  editor plan modes (`draft`, `furnished`), no-interface mode, and a start-up fit to the free canvas area.
- Inspector editing with validation.
- Materials with linked/override semantics.
- Furniture library: 270 built-in assets in 16 rooms (Sims-style room/type shelves), ~400 more in content packs in /packs
  (incl. houseplants with care guides, bathroom collection and Vietnam branded packs), colour variants with saved user
  variants
  (Halloween example), favourites, recents, search, drag and drop.
- 3D view: lighting, quality presets, wall display modes with clipped cutaway openings, saved views,
  walkthrough, guest view, and fitted framing beside panels.
- **3D editing**: drafting tools in 3D, ghost placement, transform gizmo.
- Exports: sheets, DXF, PNG, GLB, guest HTML, .neest and JSON, plus **path-traced renders**. The Export dialog
  opens instantly.
- Autosave, plus **repo `projects/` sync** with live on-disk updates.
- `start-neest.bat` (Windows), `start-neest.command` (macOS Finder) and `start-neest.sh` (macOS/Linux).
- **CC0 photo textures** with procedural fallback, photo/procedural switch in the material editor, richer
  procedural patterns, self-contained GLB/guest exports with embedded photo maps.
- **Orbit around the selection** in 3D: selecting furniture eases the orbit pivot to its centre
  (`SelectionPivot` in Scene3DView; camera stays put and turns to face it).
- Teal/brass palette.
- Four samples: a two-bedroom apartment, a 9 × 4.5 m studio, a 100 m² loft stress test and a 200 m² grand
  apartment stress test (10 rooms, ~210 items).

Next: broaden Playwright coverage (drawing, 3D editing, exports), mobile polish, and a Cloudflare sync backend
behind the storage seam (later).

Known limitations (also in README):
- Openings on curved walls follow the arc, but their frames are aligned to the local tangent.
- DXF dimensions are exploded lines/text (not DIMENSION entities).
- PDF uses flat floor colours.
- Fade/cutaway are view aids only.
- Room labels in 3D are sprites (not exported to GLB).
- The path tracer runs on the main thread (BVH build blocks briefly on large scenes).
- Repo sync exists only when served by the dev/preview server.

## 19. User requests log (this build)

1. Build the app from `_Prompt/prompt.md` (all phases).
2. "Allow full edit mode in 3D view … see placements in real time, sorta like the Sims" → 3D tool bridge, ghosts,
   gizmo.
3. "The local save folder should be inside the repo so other team members can load to test it" → repo
   `projects/` sync (done).
4. "Build and populate a 9m × 4.5m room as another sample" → `buildStudioProject` (done, tested).
5. "Add object transform and movement arrows for 3D view" → `TransformGizmo` (done).
6. "Allow ray-tracing in export" → path tracer in the Render dialog (done).
7. "Write a comprehensive knowledgebase file for other agents" → this file.
8. "Add a server launch bat file; changes should reflect in real time in the browser" → `start-neest.bat`, HMR +
   live repo-folder updates (done).
9. "Use this green (wall) and the shades as the app's accent colour" → teal/brass palette (done).
10. "The export panel must show up instantly" → dialog frame first, lazy panel (done).
11. "Generate a very complex studio, 100 m², to test stability" → `loftProject.ts` + `loft.test.ts` (done).
12. "Each project, even the repo ones, should have thumbnails" → on-demand thumbnails (done).
13. "Fit view to canvas at start" → inset-aware 2D fit and 3D framing with view offset (done).
14. "Analyze this repo and create a file to start the server quickly" → `start-neest.sh` + `start-neest.command` (macOS/Linux).
15. "Remove Present view" → removed `Present` (`plan:presentation`) tab from `EditorShell.tsx` and shortcut `3` from `useShortcuts.ts`.
16. "Make light-mode panels and UI less yellowish" → updated light-mode surface/canvas tokens in `tokens.css`, 2D light palettes in `palette.ts`, thumbnail backgrounds in `launcher.css`, and 3D default background/lighting to crisp neutral white and cool-grey tones.
17. "Rename Draft to Outline, Furnished to 2D" → updated `VIEW_OPTIONS` labels in `EditorShell.tsx` and `SHORTCUT_LIST` in `useShortcuts.ts`.
18. "Make eye icons consistent with other modern outlined icons" → replaced emoji `'👁'`/`'—'`, `'▸'` and `'★'` with outlined `Eye`/`EyeOff`, `ChevronRight` and `Star` SVG icons in `Inspector.tsx`, `ui.tsx` and `LibraryPanel.tsx`.
19. "Make active and selected states pop with a more vibrant green" → updated `--teal-*`/`--accent*`/`--selection*` tokens in `tokens.css` to emerald green and styled `.segmented button.on`, `.icon-btn.active`, `.chip.on`, `.build-card.on`, `.asset-card.on`, `.mat-cell.on`, `.mat-row.on`, and `.export-format.on` with mint-green soft backgrounds and emerald text/icons.
20. "Textures look fake: real photo textures from a free library, plus richer procedural ones" → CC0 photo sets
    (`npm run textures`), photo/procedural switch, procedural detail pass (done).
21. "Some of the shading looks very off" (streaky tinted velvet) → neutral variation maps in the fetch script (done).
22. "When an object is selected it should be the anchor point for orbit" → `SelectionPivot` (done).
23. "Allow sun diameter / diffuse light" → tried PCSS then VSM; "buggy, revert, revisit later" → reverted.
24. "Improve the furniture library: a lot more, more detailed, like the Sims" → room/type taxonomy and shelves,
    detail helpers, merged per-slot meshes, new rooms (kids, laundry, hobbies, outdoor) and 270 assets (done).
25. "Load external furniture packs (own procedural/bitmap textures), additional files, e.g. Halloween; dynamically
    loaded without refresh; one file per pack; show the source only on hover and in the item's info" → /packs (done).
26. "Doors and windows should still have designs to choose from … built in, not a pack" → `Opening.design`, 18 door
    and 12 window designs with SVG previews in the Inspector and the Door & window tool (done).
27. "When selecting material, open a full panel" → desktop finish panel docked beside the Inspector
    (`MaterialPanel`); picks apply and keep it open (done).
28. "The 3D view panel gets in the way; stash it somewhere easy to reopen" → hide button in the panel header,
    **View** toggle at the bottom of the 3D tool rail, `P` shortcut (`editorStore.viewPanelOpen`) (done). Follow-up
    "remove the chevron, the stash is enough" → desktop panel is always expanded; mobile keeps its collapse.
29. "Project panel toggle in the top bar, for all views, with more info and the plan thumbnail" → the Inspector's
    empty-selection **Project** panel (`ProjectSummary`) now shows in every workspace incl. Walk while
    `editorStore.projectPanelOpen`; top-bar toggle (`projectPanelShown`) also clears a selection / drawing tool
    that holds its place; adds the card thumbnail (`renderThumbnail`, redrawn 400 ms after changes), doors,
    windows, wall length, overall wall size and items by category (done).
30. "Middle mouse should drag in 3D" → middle-drag pans in select mode (was dolly; the wheel zooms) (done).
31. "More branded assets: TVs, washing machines and fridges" → packs `branded-tvs` (Samsung S95D/The Frame, LG C4/G4,
    Sony BRAVIA 8/9; screens show pack-pattern pictures), `branded-washers` (Bosch, Miele, LG, Samsung, LG WashTower) and
    `branded-fridges` (Samsung/LG side-by-side and French door, Bosch, Liebherr), 6 items each at published sizes with
    `brand` specs; shared `segmentText` seven-segment helper in parts.ts (done).
32. "Build a much more complex 200 m² apartment with a lot of decor to test it" → `grandApartmentProject.ts` (sample
    `grand`: 10 rooms ≈ 205 m², curved piano bay, chamfer, 28 openings, 208 items) + `grandApartment.test.ts` (done).
33. "Add a lot of detailed houseplants with clear plant info (placement, water, humidity, temperature, soil, size, pets,
    difficulty)" → `houseplants` pack (27 species: floor trees, mid-size, tabletop, hanging, in terracotta, ceramic,
    concrete, baskets, a plant stand and macramé), `PlantInfo` schema + `checkPlantInfo`, plant geometry kit, care
    block in the hover card and Inspector, plant search words (done).
34. "Shorter info for those plants" → compact care block (badges + five one-line rows); full notes behind "More care
    details" in the Inspector only (done).
35. "A lot more bathroom items, including branded" + "make sure branded packs are what we can find in VN" →
    `bathroom-collection` (25: vanities, corner basin, oval/alcove/corner baths, quadrant and grid showers, vòi xịt,
    instant heater, exhaust fan, mirrors, storage, accessories) and `branded-bathroom-vn` (TOTO MS885DE2, INAX
    AC-902VN, Caesar CD1338, American Standard Active 0955 + WF-1772, TOTO LT710CSR, Caesar L5225, GROHE Euphoria 310,
    Ariston SL2 20 RS) at sizes from Vietnamese retailer listings (done). Viglacera left out: no reliable published sizes.
36. "Check all branded packs and add more Vietnam-common stuff, incl. speakers and laptops" → existing branded packs
    kept (Miele, Liebherr and the US Bosch 800 Series are rare in Vietnam); new `branded-laptops` (MacBook Air M3,
    MacBook Pro 14 M4, Dell Inspiron 15 3530, ASUS Vivobook 15, Acer Nitro V 15, Lenovo LOQ 15), `branded-audio` (JBL
    Flip 6, Charge 5, PartyBox 110, Acnos Acoustic 3 karaoke, Marshall Stanmore III/Acton III, Samsung HW-Q600C bar +
    sub), `branded-climate-vn` (Daikin FTKB25XVMV, Panasonic XU9 indoor/outdoor, Panasonic F-409KB and F-60WWK fans,
    Xiaomi Air Purifier 4) and `branded-appliances-vn` (Electrolux EWF9024P5WB, Toshiba AW-M905BV, Panasonic
    NR-BX410WKVN, Toshiba RC-18NMFVN rice cooker, Sharp R-205VN, Karofi KAQ-U95 Pro) (done).
37. "A lot more materials for flooring, wallpaper, furniture, woods, paints, finishes; procedural and bitmap" → 17 new
    patterns, 16 new CC0 photo sets (`npm run textures`), ~100 materials (done).
38. "Colour variants under the name in the hover info, like the Sims; save your own; sensible per object; not for
    branded" → `variants.ts` themes per material family, swatches in the hover card and Inspector, placement in the
    chosen variant, saved user variants (done).
39. "Revise the plant system: all in one vegetation section; specific items with full data" → category/type `plants`
    ("Plants & flowers", 9 shelves), `PLANT_SPECIES` database (≈90 guides incl. cut/dried forms), every vegetation
    item moved there with a species guide and a description; generic Spider plant / Corn plant rebuilt (done).
40. "Index/generate thumbs for all materials and items" → `npm run thumbs` also writes `public/swatches` (fingerprint
    keyed, shared by look) and `swatchBackground` uses them; tests fail when a file is missing (done).
41. "Make sure other agents follow the asset structure" → §12 "Asset rules", AGENTS.md and packs/README.md, enforced by
    `assetRules.test.ts` (descriptions with a frozen legacy list, tags, shelves, brands, plants, thumbnails) (done).
42. "A tad denser library, or 3 levels" → Large / Medium / Small card size in the library header (done).
43. "Correctly sized humans (Asian first) in many poses with clothing variants" → `people` pack with the pose system;
    then "less mannequin-like, low poly but realistic, from the internet" → CC0 Quaternius characters baked into
    our poses (`npm run people`), shown via the new shipped-model path; procedural figure kept as fallback (done).
44. "Colour variants for doors and windows" + "all variants can be saved back" → opening finish sets with
    Save as variant (furniture, people outfits, doors and windows all save their own) (done).
45. "More detailed couches and sofas with variants" → `sofas` pack, 17 sofas (done).
46. "Model variants as separate assets (shelves with/without books, tables with/without tableware)" → `model-variants`
    pack, 27 versions listed next to their originals (`variantOf`) (done).
47. "A lot of kitchen counters incl. sinks" → `kitchen-counters` pack, 28 items (done).
48. "Grouping of placed items, saved to a Groups section; disable Alt; right-click menus incl. group/ungroup" → groups,
    Saved groups shelf, 2D/3D/library context menus, Alt and native-menu suppression (done).
49. "Picking a variant should enter place mode (keep the hover card)" (done).
50. "A Ceiling category that hides ceiling-attached objects but keeps their lighting" (done).
51. "Don't open the view settings automatically in 3D; merge the door/window tool settings into browsing" → view panel
    closed by default; design and finish under the Doors / Windows Build cards (done).
52. "More controls for curved walls, e.g. a curve between two perpendicular walls; a bigger round peak" → two-handle
    curves, Fit to joined walls, Circular arc, handle-length slider, tangent snapping; curve-tool preview no longer
    filled black (done).
53. "Two-sided material slots make no sense for a glass wall" → glass walls and railings show only glazing and frame
    finishes (done).
54. "Build some of the furniture in these photos" → `soft-modern-home` pack, 22 items (done).
55. "A lot more paintings: abstracts, real landscapes, animals, fetched from the internet" → `paintings` pack: 44
    public-domain works (Art Institute of Chicago CC0, Wikimedia Commons) at real size in three frame styles with
    frame variants; `npm run paintings` (tools/fetch-paintings.mjs) downloads them into public/art/ (credits in
    public/art/CREDITS.md) as square tiles rolled by half, so a canvas w × h with texture scale max(w, h) shows the
    painting exactly once (box faces are UV-mapped in metres about their centre). Sizes are fixed (done).
56. "A lot more curtains, for doors and windows and big ones for full glass walls, in many colours and patterns" →
    `curtain-collection` pack: 24 items (wave, sheer, double track, pinch pleat, eyelet, tab top, café, Roman,
    pelmet drapes, cellular, door curtains, string curtain, sash, glass-wall sheers and pairs up to 12 m, vertical and
    panel blinds), open/drawn versions via `variantOf`, 40+ fabrics and 11 printed patterns (done).
57. "Show in library" button in the Inspector header (replaces rotate) → opens the library on the item's card (done).
58. "Groups as the 3rd library tab with real thumbnails and normal placement" → saved groups are `savedgroup:<id>`
    assets (extra `getAsset` resolver), placed with the ghost and rotation like any item (done).
59. "A versioning system: several versions of the same layout in one project" → Layout options (§9) (done).
60. "When a new object is placed, keep it selected even if the click lands on another object" (done).
61. "Switching a wall to a railing and back leaves it half height" → `setWallStyle` remembers the full height (done).
62. "Too staged: add normal living items, food on the table, paintings" → `lived-in` pack (12 items: meals, shared
    dishes, mugs, open book, magazines, remote, chopping board, condiments, dish soap, sneakers, slippers, toiletries)
    (done).
63. "A lot of pre-built groups (bedroom setups, kitchens), named properly, with descriptions" → 39 ready-made groups
    on 9 shelves, group descriptions and the details dialog, content-based group names (done).
64. "A lot of L-shaped kitchen sets, including cupboards" → 14 generated L kitchens with base and wall cupboards,
    corner units, tall units, hoods and everyday items, in different finishes and both hands (done).
65. "Invisible walls so one room can have two floor finishes" → invisible room dividers (done).
66. "Adjust all walls of the same type together: thickness, height, other settings, materials" → Wall types (done).
67. "Pets stuff (2 lovebirds) incl. a modular cage like the photo, and lots for dogs and cats" → Pets category and
    pack; cage wires as a see-through texture (cutout patterns) (done).
68. "A lot of desks incl. L shapes, and chairs for them" → workspace pack, desk-setup groups (done).
69. "5 more 60LTN studio options with kitchen near the balcony, bed and sofa, cozy with a palette; lovebird cage,
    washer-dryer stack with the AC unit on top on the balcony; a shared desk with laptops for two" → options C–G and
    updates to A–G (done).
70. "Fill the shelves, racks, tables and desks with a lot more stuff; more detailed cabinets, wardrobes and shelves"
    → `styled-storage` pack (17 items with varied contents) and decor added to 60LTN options A–G (done).
71. "Allow a FOV setting for the camera" → View panel field of view (orbit and walkthrough) (done).
72. "Girl stuff: makeup table, makeup, sets of lotions and more" → `beauty` pack (21 items) (done).
73. "Randomize the filled assets, some look too repetitive" → per-part texture offsets (`Part.uv`) and varied shelf
    styling (done).
74. "Turn the filled version into a model variant system beside the colour variants, picked when browsing or after
    placing; contents must not affect outline or size; more than two models possible, unobtrusive" → model variants
    (§12) (done).
75. "A collection system, groups in the Furniture dropdown, shared between options" → collections (§12) (done).
76. "Make the AC outdoor units much more detailed" → Panasonic CU-XU9ZKH-8 rebuilt (fan, grille, coil, valves) (done).
77. "Let the wall win texture fights" → wall polygon offset (done). "The sink looks wrong" → sink bays stop below the
    bowl (done).
78. "More dynamic 3D loading animation; what takes so long" → staged loading screen, texture cap and batched uploads
    (done). "Keep the info card open when changing the model" (done).
79. "Move the theme into settings" → Settings → Appearance (the editor top bar no longer has it) (done).
80. "White items blend into the library background" → deeper thumbnail backdrop and a soft outline shadow (done).
81. "A lot more electronic appliances: Xiaomi standing fans, stick and robot vacuums, other home electronics" →
    `branded-home-electronics` pack (34 items at published sizes): Xiaomi Smart Standing Fan 2 / 2 Lite / 2 Pro and Smart
    Tower Fan; Dyson V15 Detect and V12 Detect Slim and Xiaomi G11 on wall docks, Dreame H12 Pro wet-dry on its base,
    Hitachi CV-SF16A canister; robots with docks (Xiaomi S10, Xiaomi X10+, Roborock S8 Pro Ultra, Ecovacs T30 Omni);
    Xiaomi Air Purifier 4 Lite / 4 Pro, Sharp KC-G40EV-W, Daikin MCK55TVM6, Dyson TP07, Xiaomi Humidifier 2 and
    Dehumidifier 22L; Xiaomi Space Heater S, FujiE OFR4411 radiator; Google Nest Audio / Mini / Hub, Apple HomePod mini /
    HomePod; Xiaomi AX3000T, TP-Link Archer AX73 and Deco X50; Xiaomi Kettle 2, Philips HD9252 and Xiaomi 6.5 L air
    fryers, Philips HR2041 blender. Branded items may now list the maker's own finishes as hand-made `variants`
    (Nest fabrics, HomePod colours, Roborock black/white, Dyson gold, TP07 black/nickel); no themes or saved variants (done).
    Pitfall: a pack `build()` that throws falls back to a plain box and still passes `npx vitest run src/packs`; look at
    the renders (the stick vacuums did this until a variable-order bug was fixed).
82. "Many more structure items, detailed and realistic" → `structures` pack (54 items; §12):
    - Columns: reeded classical, Tuscan, panelled pilaster, oak slat-clad, steel H, board-formed mushroom,
      marble with brass inlays, mirror-tiled, timber post and beam, downstand beam, ceiling joists, steel I-beam.
    - Built-ins: coffered and LED-cove tray ceilings, kitchen soffit with downlights, pipe riser boxing, L duct chase,
      window seat with bookcases, storage window seat, banquette, wardrobe wall, media wall, alcove cupboard, desk
      nook, raised platform with drawers, entryway bench.
    - Heating: chimney breast with log burner, linear electric fire, cast-iron radiator, double-panel radiator,
      radiator cover, wood stove with flue.
    - Partitions: half walls (oak cap, columns, spindles), archway, reeded-glass arched door, barn doors, breeze
      blocks (gạch thông gió), curved glass block, serpentine slats, arched cane panels.
    - Stairs & steps: straight, floating with glass, steel spine, L, U, spiral, loft ladder, alternating tread,
      split-level steps, bullnose steps, glass and spindle balustrades. All items are resizable and have finish
      variants (done).
    Pitfall: a `containParts` guard silently shrinks parts that leave the box, so the size checks pass while the
    geometry is wrong. Check a pack with the guard turned off (compare the output parts by identity) before relying on it.
83. "Fix the texture fighting in general, also in objects (Xiaomi Air Purifier 4 Pro top)" → per-mesh depth bias for
    walls, wall trim and item slots (§16), glass frames and railings stop at the faces of walls they meet, purifier
    grilles stand proud, a coplanar-faces asset rule (done).
84. "Moving objects is sluggish (only with the library open)" → the library re-rendered every card per move and its
    footprint cache (800) kept clearing: subscriptions narrowed, `LibraryPanel` memoised, cache 5000 (300–870 ms →
    ~35 ms per move in 60LTN). Wall-snapping items no longer stick to every wall in narrow rooms while moved
    (`WALL_HUG_MOVE` 8 cm) (done).
85. "Centring the camera on the selected object: a setting, off by default" → Settings → 3D view (done).
86. "Floor reflections by roughness, ultra only" → `floorReflections.tsx`: a half-resolution mirror pass of the
    scene in the floor plane; floors use reflective material copies that blend it by Fresnel × gloss and blur it with
    the mip level from roughness (none above 0.75) (done).
87. "More annotation dimensions (basic and detailed), Annotations under the overview, Items by category last, no wall
    types" → door & window widths, wall thickness and item sizes (`settings.dimensions.openings/thickness/objects`),
    shared `AnnotationToggles` in the Project panel and Project settings (done).
88. "Quality quick switch on hovering the View button" (portal flyout, above the panels) (done). "Shown ceilings must
    stop the sun" → ceilings cast shadows (done).
89. "Measure: the snapped end point loses its straight angle" → wall and face snaps land where the angle-constrained
    ray crosses them (`snapPoint`) (done). "Show the number of options on project cards" (done).
90. "Join two walls with a rounded corner" → select the two walls → Corner → Round corner (`roundCorner`: both walls
    cut back, a tangent circular-arc wall joins them, openings stay put, radius capped by the shorter wall) (done).
