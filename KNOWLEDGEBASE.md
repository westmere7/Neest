# Neest — Knowledge Base for Agents and Contributors

> Single source of truth for how Neest is built, why it is built that way, and the traps already found.
> Read this before changing code. Keep it current: when you add a feature, fix a non-obvious bug, or change a
> convention, update the relevant section (and the "Status & roadmap" section) in the same change.

Last updated: 2026-10-17.

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

On Windows, double-click **`start-neest.bat`**. It checks for Node ≥ 20, runs `npm install` when `node_modules` is
missing or broken, then starts the dev server on port 5173 and opens the browser. Use `start-neest.bat --lan` to
expose it on the local network.

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
projects/                Shared project folder mirrored by the dev server (README.md explains it)
public/                  favicon (PWA icon)
start-neest.bat          Windows launcher (Node check, npm install, dev server, browser)
tools/
  neest-workspace-plugin.ts  Vite plugin: /__neest/fs endpoints + projects/ watcher (dev & preview only)
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
    materials/           catalog.ts (≈90 materials, defaults), patterns.ts (28 procedural seamless textures)
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
    materials/           MaterialUI (slot rows, picker with apply scopes, library, editor), textureCache
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
| `MaterialDefinition` | `color`, `roughness`, `metalness`, `opacity`, `emissive*`, `texture {patternId, scale m/tile, rotation°, contrast}`, `overrideOf` (unlinked per-surface copy), `catalogId`, `source` licence |
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

- **Assets** (`data/assets`): 86 procedural assets across construction, living, bedroom, dining, kitchen,
  bathroom, office, storage, lighting, decor, electronics, generic. Each has stable id, category, tags,
  default/min/max size, resizable flags, mount (floor/wall/ceiling), default elevation, material slots with
  catalogue defaults, `build(size) → Part[]`, optional `planDetail`, optional `light`, `wallSnap`.
  2D footprints are **derived** from part convex hulls drawn by height. Add assets with the helpers in
  `parts.ts` (`box`, `span`, `cyl`, `legs4`, `fronts`, `defineAsset`, …); `catalog.test.ts` validates every asset at
  default/min/max sizes (bounds, slots, materials).
- **Materials** (`data/materials/catalog.ts`): ≈90 materials in 12 categories; defaults in `DEFAULT_MATERIALS`.
  Textures are **procedural** (`patterns.ts`, 28 seamless tiles drawn with wrap-around maths, deterministic seeds,
  normal maps derived by Sobel). Texture × colour (multiply) model: tiles are near-white luminance; three tiles
  (`art`, `books`, `rug-geometric`) are coloured. No third-party texture files → no licence obligations.
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
| GLB | `sceneExport.ts`: standalone scene from the same builders → GLTFExporter (binary) |
| Guest walkthrough | `guestExport.ts`: one HTML file = inline viewer runtime (three.js included) + base64 GLB + cameras, spawn, colliders. No external URLs, blob URLs or storage access |
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
  edits with undo/redo), asset catalogue (1224 checks), texture patterns (123 checks). Canvas 2D is unavailable
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
- 2D drafting: walls, curved walls, rooms, openings, split, measure, snapping, typed lengths, dimensions, three
  plan modes, no-interface mode, and a start-up fit to the free canvas area.
- Inspector editing with validation.
- Materials with linked/override semantics.
- Furniture library: 86 assets, favourites, recents, search, drag and drop.
- 3D view: lighting, quality presets, wall display modes with clipped cutaway openings, saved views,
  walkthrough, guest view, and fitted framing beside panels.
- **3D editing**: drafting tools in 3D, ghost placement, transform gizmo.
- Exports: sheets, DXF, PNG, GLB, guest HTML, .neest and JSON, plus **path-traced renders**. The Export dialog
  opens instantly.
- Autosave, plus **repo `projects/` sync** with live on-disk updates.
- `start-neest.bat`.
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
