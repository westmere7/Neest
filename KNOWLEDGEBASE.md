# Neest — Knowledge Base for Agents and Contributors

> Single source of truth for how Neest is built, why it is built that way, and the traps already found.
> Read this before changing code. Keep it current: when you add a feature, fix a non-obvious bug, or change a
> convention, update the relevant section (and the "Status & roadmap" section) in the same change.

Last updated: 2026-10-17 (photo textures).

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
public/                  favicon (PWA icon), textures/ (CC0 photo maps + manifest.json, from `npm run textures`)
start-neest.bat          Windows launcher (Node check, npm install, dev server, browser)
start-neest.command      macOS Finder double-click launcher (invokes start-neest.sh)
start-neest.sh           macOS/Linux shell launcher (Node check, npm install, dev server, browser)
tools/
  neest-workspace-plugin.ts  Vite plugin: /__neest/fs endpoints + projects/ watcher (dev & preview only)
  neest-packs-plugin.ts      Vite plugin: hot-reloads the pack loader when /packs files are added/deleted
  fetch-textures.mjs     `npm run textures`: downloads/re-encodes the CC0 photo texture sets (needs sharp, dev dep)
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
                         loftProject (100 m² stress sample), sampleHelpers (shared sample builders)
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
    library/             LibraryPanel (Build / Furniture / Materials tabs), thumbnails, ImportModelDialog,
                         useDropAsset
    materials/           MaterialUI (slot rows, picker with apply scopes, library, editor, photo/procedural
                         switch), textureCache (swatches), photoTextures (manifest, image loading, colour maths)
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
| `Opening` | host `wallId`; `kind` (door-single/double/sliding, passage, window-single/double/fixed/sliding); **`offset` = arc length from node `a` to the opening centre**; `width`, `height`, `sillHeight`; `swingSide` left/right; `hinge` start/end; `openAngle` (3D only); `style`; frame/panel material ids |
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
  state, `cameraRequest` for 3D views.
- After undo/redo `EditorPage` prunes selections pointing at deleted entities.

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
  PMREM + hemisphere + time-of-day sun with shadows; lamp point lights in High), view panel (saved views,
  walls, quality & light, categories).
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
  While a drafting tool is active, left button belongs to the tool; orbit is right-drag, pan middle-drag.
  `TransformGizmo`: X/Z arrows (slide), Y arrow (elevation, 5 cm steps), centre disc (free floor move), ring
  (rotate, 15° steps; Alt = free). Grid-snapped, live readouts, one undo step per drag. Furniture body drag also
  works (with wall hugging). Library drag-and-drop works onto the 3D canvas.
- **Path tracing** (`pathTrace.ts › renderPathTraced`): clones the `neest-plan` group without helpers/sprites,
  adds a ground disc, a gradient sky (`GradientEquirectTexture`), the sun and up to 16 lamp point lights, and
  renders with `WebGLPathTracer` (three-gpu-pathtracer 0.0.23, tiles 2×2) from a clone of the live camera.
  Progressive samples with progress/ETA, a live preview canvas, Stop & keep, and Cancel (`AbortSignal`).
  Frames are yielded with `MessageChannel`, not rAF, so rendering continues in background tabs. BVH is built
  synchronously (`setScene`); `setSceneAsync` needs a BVH worker. All GPU resources are disposed defensively.
- Walkthrough: pointer-lock mouse look + WASD/Shift, touch joystick + drag-look, eye height 1.6 m, collisions.
- Guest view (`#/guest/:id`) is view-only; the exported guest HTML embeds a GLB + the standalone runtime.

## 12. Library & materials

- **Assets** (`data/assets`): 270 procedural assets, one module per room. Each has:
  - a stable id
  - **category** (room: living, bedroom, kids, dining, kitchen, bathroom, laundry, office, hobbies, outdoor, storage, lighting, decor, electronics, construction, generic)
  - **type** (what it is: seating, beds, surfaces, storage, appliances, plumbing, lighting, decor, plants, electronics, activities, kids, structure, misc)
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
- **Tests**: `src/packs/packs.test.ts` loads the real `/packs`, runs `describeAssetChecks` on every pack item, and checks namespacing, textures, reload replacement and the build fallback. Run it with `npx vitest run src/packs`.
- **Materials** (`data/materials/catalog.ts`): ≈130 materials in 12 categories; defaults in `DEFAULT_MATERIALS`.
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
  history (undo/redo, gesture collapsing), schema, sample projects (three samples; studio is exactly
  9 × 4.5 m with no colliding furniture), the **loft stress sample** (`loft.test.ts`: schema, curved walls,
  unclamped openings, four rooms ≈ 100 m², no error diagnostics, derive < 60 ms, DXF/sheet/report, mass
  edits with undo/redo), asset catalogue (1224 checks), texture patterns (123 checks), photo textures (set list, catalogue mapping, manifest/files/size budget, load-time photo fill, registry fallback). Canvas 2D is unavailable
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

## 17. Recipes

- **New tool**: implement `Tool` in `plan-2d/tools/`, register it in `PlanCanvas` and `ToolBridge3D` (if it works
  in 3D), add to `TOOLS` in `EditorShell` and `TOOL_SHORTCUTS`. Emit previews via `ToolOverlay` only.
- **New asset**: add to the category file with `defineAsset` helpers; slot defaults must exist in the material
  catalogue; run `npx vitest run src/data/assets`.
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
- Furniture library: 270 built-in assets in 16 rooms (Sims-style room/type shelves), content packs in /packs
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
- Three samples: a two-bedroom apartment, a 9 × 4.5 m studio, and a 100 m² loft stress test.

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
