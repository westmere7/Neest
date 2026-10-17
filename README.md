# Neest

A local-first apartment floor planner that runs in the browser. You draft walls, rooms, doors and windows precisely in 2D, see and edit the same model live in 3D, dress it with a parametric furniture library and shared materials, walk through it, and export drawings, CAD files, renders and a shareable walkthrough.

There are no accounts and no server. Projects are stored in your browser and work offline. When you run Neest from this repository, projects are also mirrored to the `projects/` folder so a team can share them through git.

> Neest drawings are planning drawings, not certified construction documents.

## Quick start

Requirements: Node.js 20 or newer (developed on Node 22) and a WebGL2-capable browser (current Chrome, Edge, Firefox or Safari).

**macOS:** double-click `start-neest.command` in Finder (or run `./start-neest.sh` in Terminal).

**Windows:** double-click `start-neest.bat`.

**Linux:** run `./start-neest.sh`.

Each launcher checks Node ≥ 20, installs dependencies on first run, starts the dev server on <http://localhost:5173> and opens your browser. Pass `--lan` (e.g. `./start-neest.sh --lan` or `start-neest.bat --lan`) to reach it from other devices on your network.

**Manual start (any platform):**

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. Edits to the source code reload in the browser automatically.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds the guest-viewer runtime, then starts the Vite dev server (port 5173). |
| `npm test` | Unit and domain tests (Vitest, jsdom). |
| `npm run test:e2e` | Browser smoke tests (Playwright). Run `npx playwright install chromium` once first. |
| `npm run typecheck` | Guest runtime build plus `tsc -b`. |
| `npm run lint` | ESLint. |
| `npm run build` | Guest runtime, type check and production build into `dist/` (installable PWA, works offline). |
| `npm run preview` | Serves the production build locally (repo-folder sync works here too). |
| `npm run format` | Prettier. |

## Features

### Projects
- Launcher with plan thumbnails, room count, area, item count and last-saved time. Create, rename, duplicate, delete, import and export projects.
- Three built-in samples: a two-bedroom apartment, a furnished 9 × 4.5 m studio, and a 100 m² loft with curved and angled walls, a glass partition and about 110 items (useful as a stress test).
- Autosave about 0.7 s after each committed edit, never on every pointer move. The status reads Saving…, Saved locally, or Save failed.

### 2D drafting
- Wall chains, curved walls (quadratic Bézier), rectangular rooms, doors, windows and passages, wall split, and a measuring tape.
- Snapping to endpoints, midpoints, wall faces, 45° angles, alignment guides and the grid. Hold Alt to disable snapping, Shift to lock the angle.
- Exact input while drawing: type `3.5`, `350cm` or `11'6"` then Enter; room sizes as `4x3`.
- Junction mitres, T-junctions and crossings are resolved automatically. Rooms are detected from the walls, with clear-floor area and perimeter.
- Dimensions, room labels, and two editor plan modes: draft and furnished (plus presentation style in exports). Diagnostics flag crossing walls, openings that don't fit, and rooms that can't be inset.
- The plan fits itself between the floating panels when a project opens.
- Undo/redo for every operation; a drag is one step.

### 3D
- The same model in 3D. Doors and windows are real openings. Lighting has a time-of-day sun and soft shadows; quality presets are draft, balanced and high.
- Wall display: full, cutaway at a chosen height, fade near the camera, or hidden. Saved camera views, top, isometric and front views, and a home view that frames the plan beside the panels.
- **Edit in 3D:** draw walls and rooms, insert openings, place furniture with a live ghost preview, and move objects with the transform gizmo (arrows, height, free move, rotation ring), all snapped and undoable.
- First-person walkthrough with collisions (mouse and keyboard, or touch joystick). Guest View is a view-only presentation mode.

### Library and materials
- 270 detailed, parametric furniture and fixture assets. Browse Sims-style **by room** (living, bedroom, kids, dining, kitchen, bathroom, laundry, study, hobbies, balcony, …) or **by type** (seating, beds, surfaces, appliances, plumbing, lighting, decorations, plants, …), on themed shelves, with search, favourites and recents. Each asset has size limits, material slots, and a 2D footprint derived from its 3D shape. You can also import GLB/glTF models (up to 60 MB).
- **Content packs:** drop a single `packs/<name>.pack.ts` file into the repo to add items, materials, procedural patterns and embedded bitmap textures, such as a team pack or a seasonal Halloween pack. Packs load into the running app without a refresh, and appear in the normal library shelves. Hover a card, or check a placed item's info, to see which pack it came from. See [packs/README.md](packs/README.md).
- About 130 materials. Woods, floors, tiles, stone, plaster, brick, fabrics, leather, rugs, rattan, cork and brushed metal use CC0 photo textures (colour, relief and roughness maps); every textured material also has a procedural, seamless texture that is used when the photo files are missing. The material editor switches each material between **Photo** and **Procedural**. Assignments are linked: editing a material updates every surface that uses it. You can apply to similar surfaces, rooms or instances, or unlink a single surface as an override.

### Exports
| Output | Notes |
| --- | --- |
| Plan sheet: PDF, SVG, PNG | A4–A2, Letter and Tabloid paper at 1:20–1:200 (or fit), with a title block, scale bar and room schedule. PDF linework is vector. |
| Plan image PNG | Pixels per metre, optional transparent background. |
| DXF | AutoCAD R12 ASCII at 1:1 in mm, cm, m or inches. Layers for walls, doors, glazing, rooms, text, dimensions and furniture. |
| 3D render PNG | **Real-time** (matches the current camera), or **Path traced** for physically based light with 32–1024 samples, progress, and stop-and-keep. |
| GLB | The 3D scene with its materials and transforms. |
| Guest walkthrough HTML | One self-contained file (viewer + model) that opens offline in any modern browser. |
| `.neest` project | ZIP with the project JSON and any imported models. Use it to back up or move projects. |
| JSON summary | Rooms, areas, items and materials. |

Exported filenames follow `<project>_<yyyy-mm-dd>_<output>.<ext>`.

### Interface
- Floating panels, light and dark themes, and a deep teal accent. Press `\` to hide the interface for review or screenshots.
- On phones you can open projects, inspect, view in 3D and walk through. Drafting tools, split view, scaled sheets and DXF are desktop-only.

### Keyboard shortcuts
`V` select · `H`/Space-drag pan · `W` walls · `C` curved wall · `R` room · `D` door/window · `S` split · `M` measure · `Ctrl+Z`/`Ctrl+Shift+Z` undo/redo · `Delete` · `Ctrl+D` duplicate · `Q` rotate 90° · arrows nudge (Shift ×10) · `Ctrl+L` lock · `F` fit · `G` grid · `1`/`2` plan modes · `4`/`5` 3D/split view · `\` hide interface · `?` all shortcuts.

## Where your projects live

- **In the browser (always):** IndexedDB, database `neest`. It holds the project documents, launcher metadata and thumbnails, imported model files and preferences. It works offline and survives reloads. It is per browser and per site, so a private window or clearing site data removes it. Export `.neest` files to back up.
- **In the repo (`projects/`, dev and preview server only):** each project you open or edit is mirrored to `projects/<name>__<id>.json`, and imported models to `projects/assets/`. Commit what you want to share; teammates see it after `git pull`.
  - A project in the folder that your browser hasn't seen appears under **From the repo folder** in the launcher.
  - A newer copy in the folder opens instead of the browser's.
  - Changes to the folder while the app is open appear within about a second, as an undoable step.
  - Turn **Sync to repo** off in the launcher to stop mirroring.
  - See [projects/README.md](projects/README.md).
- **Import and export:** launcher → **Import** accepts `.neest` files and plain project JSON. Each card's menu and the editor's Export dialog produce `.neest` files. Imports are validated (file type, size, schema and references), and older files are migrated.

The storage code sits behind interfaces in `src/storage/repository.ts`, so a synced backend (for example Cloudflare D1/R2) can be added later without touching the editor.

## Architecture

React 19 + TypeScript + Vite. The 2D editor is SVG; the 3D view uses three.js through React Three Fiber and drei. State uses zustand and immer, the schema and validation use Zod, and storage uses Dexie (IndexedDB).

- One project model, in metres, drives everything. The 2D plan, the 3D scene and every export are derived from it, and nothing keeps a second copy of the geometry.
- `src/domain` holds pure, unit-tested logic: the schema, geometry (walls, junctions, openings, room detection, snapping) and commands. Every edit is a command, so undo/redo and autosave work the same everywhere.
- The 2D renderer is a pure component, reused for on-screen drawing, print sheets and thumbnails.

Contributors and coding agents should read [KNOWLEDGEBASE.md](KNOWLEDGEBASE.md). It covers conventions, algorithms, known pitfalls, recipes and status.

## Known limitations

- One level per project. No storeys, stairs between floors, roofs or terrain.
- Openings on curved walls follow the arc, but their frames are aligned to the local tangent.
- DXF dimensions are exploded lines and text, not associative DIMENSION entities. Furniture is exported as outlines, and curved walls as arcs and polylines.
- PDF sheets use flat floor colours (no textures).
- GLB export contains geometry, materials and transforms only. Room labels and editor lighting are not included.
- The guest HTML embeds the whole model as base64, so large projects produce large files.
- The path tracer runs on the main thread. Building its acceleration structure briefly pauses the page on large scenes, and the quality depends on the GPU.
- Fade and cutaway are view aids only. They don't change the model or exports.
- Repo-folder sync works only when Neest is served by its own dev or preview server. A static host stores projects in the browser only.

## Licences and asset sources

- **Furniture and fixtures:** all built-in assets are procedural geometry written for this project (`src/data/assets`). No third-party models are bundled.
- **Content packs** (`packs/`): each pack declares its own licence, which is shown in each of its items' and materials' info. The included Halloween pack is original work (CC0).
- **Materials and textures:** photo textures in `public/textures/` come from [ambientCG](https://ambientcg.com) and [Poly Haven](https://polyhaven.com) and are **CC0 1.0** (public domain, no attribution required; credits are kept anyway in `public/textures/manifest.json` and `public/textures/CREDITS.md`). They are downloaded, resized and re-encoded as WebP by `npm run textures` (`tools/fetch-textures.mjs`, set list in `src/data/materials/photoSets.json`); the script skips sets already present. Procedural textures are generated at runtime (`src/data/materials/patterns.ts`, original work) and are the fallback whenever the photo files are absent, so deleting `public/textures/` is safe.
- **Imported models:** you supply these. Neest stores the licence text you enter with each model in the project. Make sure you have the right to use and share them.
- **Libraries:** React, React DOM, three.js, React Three Fiber, drei, zustand, immer, Zod, fflate, jsPDF, svg2pdf.js, three-gpu-pathtracer, three-mesh-bvh and vite-plugin-pwa are MIT-licensed. Dexie is Apache-2.0 and lucide-react is ISC. The guest export inlines three.js (MIT) in the generated HTML.
