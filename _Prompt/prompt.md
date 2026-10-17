# Neest — Product, Architecture, and Implementation Brief for Claude

> **Purpose:** Build a real, usable, browser-based apartment floor-planning application named **Neest**. This is an implementation brief, not a request for a concept, a static prototype, or a product plan. Build the app in the current repository, run it, test it, and leave it in a working state.

## 1. Your role and operating rules

Act as a senior product designer, frontend/3D engineer, and software architect working together. Make sensible decisions independently and implement them. Do not stop after producing a plan or a list of recommendations.

1. **Inspect first.** Examine the repository, existing code, package manager, scripts, and any project instructions before making changes. Preserve useful existing work. If the repository is empty, scaffold the project.
2. **Deliver working software.** Build end-to-end vertical slices. Avoid placeholder buttons, dead controls, fake dialogs, decorative panels that do nothing, and hardcoded screenshots masquerading as an editor.
3. **Work incrementally.** Establish a runnable application early. After each substantial feature, run type checks, tests, and the build; fix regressions before continuing.
4. **Prefer a complete, coherent core over a wide but hollow feature list.** Every visible high-priority control should perform the action it advertises. When a feature is not implemented yet, either omit it, mark it clearly as planned, or disable it with a clear explanation.
5. **Do not overengineer future infrastructure.** This version is entirely local-first. Do not add authentication, user accounts, a backend, databases requiring a server, payment flows, cloud rendering, collaboration services, or API keys. Prepare clean interfaces for future Cloudflare integration without requiring it now.
6. **Keep documentation current.** Create or update `README.md` with setup, run, test, build, persistence, export, known limitations, and asset-license information. Add concise architecture notes when useful.
7. **Be transparent about trade-offs.** If a requested engineering feature is too large to implement robustly in one pass, implement a reliable smaller version and document the exact limitation. Never claim that an unfinished feature is complete.
8. **Do not ask me to make routine technical choices.** Choose appropriate defaults. Ask a question only if a missing decision genuinely blocks implementation; otherwise proceed with reasonable assumptions.

## 2. Product vision

**Neest** is a desktop-first, browser-based apartment floor planner that combines precise 2D architectural planning with an integrated 3D interior editor and real-time visualization. It should feel like a focused design workspace rather than a complicated CAD package or a game.

The primary workflow is:

1. Start a project and set its units and dimensions.
2. Draw or edit a precise apartment plan in top-down 2D.
3. Add and configure wall segments, openings, rooms, fixtures, and furniture.
4. Apply materials and colors through a reusable global material system.
5. Switch between drafting, furnished-plan, 3D, render, and walkthrough views without duplicating or losing project data.
6. Export technical drawings, selected-angle 3D views, renders, and a view-only walkthrough that can be opened by someone else.
7. Save locally and return to the same project without needing an account or network connection.

### Scope boundaries

This is an **apartment/interior floor planner**, not a full house-building simulator. Focus on one apartment level per project. Do not build multi-storey architecture, foundations, basements, roof construction, terrain, structural engineering calculations, or an expansive Sims-style character/game system. A user should be able to plan the whole apartment interior, including rooms, partitions, doors, windows, furniture, fixtures, and finish materials.

The design should be approachable to a home owner but sufficiently precise for serious layout planning. Clearly label exports as planning drawings, not certified construction documents.

## 3. Reference products and what to learn from them

Use these products as functional and interaction references, not as assets or UI to copy verbatim:

- Planner 5D — https://planner5d.com/ — a unified 2D/3D editor, clear build and furnishing catalogues, quick view switching, and project-level controls.
- Floorplanner — https://floorplanner.com/ — fast wall/room editing, large object catalogue, and convenient real-time 3D viewing.
- Home Design AI — https://home-design.ai/ — clear distinctions between technical plans, furnished views, 3D perspectives, and different visualization outputs.
- Homestyler — https://3d.homestyler.com/ — material/furnishing exploration and polished interior visualization.

Extract the useful ideas: a clear tool hierarchy, fast wall drawing, accessible libraries, accurate dimensions, live 3D feedback, and straightforward export. Do not reproduce their logos, branded assets, exact screen designs, or proprietary catalogues.

## 4. Platform and product principles

- **Desktop-first:** Optimize the full editing experience for a mouse and keyboard on a laptop/desktop, with a sensible minimum target viewport around 1280×720.
- **Mobile-compatible:** Mobile is for opening projects, navigating the plan, viewing 3D/walkthroughs, changing simple properties/material colors, and doing lightweight placement or inspection. Complex drafting, detailed wall topology editing, and technical sheet configuration may be desktop-only. Explain this in the mobile UI instead of presenting tiny or unusable desktop controls.
- **Local-first:** Projects and preferences persist in the browser. Core features work with network access disabled after the initial app load, except for assets intentionally imported by the user.
- **One source of truth:** 2D, 3D, material assignments, dimensions, and exports must all derive from the same project model. Never build separate unrelated 2D and 3D representations that drift apart.
- **Precision with a friendly surface:** Internally use real-world units and explicit geometry. Externally use clear, compact tools, contextual inspectors, live measurements, snapping, and undo/redo.
- **Non-destructive editing:** Global materials, object duplication, selection, undo/redo, and imports should behave predictably.
- **Responsive performance:** Editing should feel immediate. Avoid rebuilding the entire 3D scene or rerendering every object on every pointer-move if targeted updates will work.
- **Polished restraint:** Use whitespace, layered floating controls, good typography, careful motion, clear states, and a high-quality dark/light theme. Avoid overfilled toolbars, persistent giant sidebars, gradients everywhere, or unnecessary visual decoration.

## 5. Recommended technology stack

Use the following stack unless the existing repository has a compelling, working alternative. If you deviate, explain why in the README.

- **Application:** React + TypeScript + Vite.
- **2D plan editor:** SVG-based rendering with custom geometry and pointer interactions. Keep the floor-plan model independent of SVG coordinates. An SVG layer is useful for vector lines, selection outlines, labels, snapping guides, dimensions, and crisp zooming.
- **3D viewport:** Three.js with React Three Fiber and Drei, or an equally well-supported direct Three.js implementation if it materially simplifies robust geometry generation. Use one coherent approach rather than mixing rendering abstractions casually.
- **State:** Zustand for UI/view state, with a clear domain-command layer for model edits and history. Keep 3D rendering state separate from persisted project data.
- **Validation and schemas:** Zod (or equivalent) for project/import validation and schema-version migration.
- **Local persistence:** IndexedDB through Dexie (or equivalent) for projects, preferences, and any binary asset blobs. LocalStorage may be used only for tiny preferences, not as the main project database.
- **Styling:** Tailwind CSS or CSS Modules with design tokens/CSS custom properties. Avoid a component library that forces a rigid admin-dashboard feel. Use accessible headless primitives if useful.
- **Testing:** Vitest for domain/geometry logic; React Testing Library for important UI behavior; Playwright for a small set of end-to-end critical flows.
- **Exports:** SVG/PNG for drawings, vector PDF where possible, DXF for CAD interoperability, PNG render capture, and GLB/glTF export for 3D. Choose stable, browser-compatible libraries or write a small focused DXF serializer if that is simpler and reliable.
- **Code quality:** ESLint and Prettier, strict TypeScript, and sensible module boundaries.

Use compatible stable package versions appropriate to the repository and runtime. Do not blindly upgrade unrelated packages.

## 6. Information architecture and application shell

Create a professional shell around a large, uninterrupted work canvas.

### Home / project launcher

A tidy start screen should provide:
- Create new apartment project.
- Open recent projects, with project name, last modified time, preview/thumbnail when available, and local save status.
- Rename, duplicate, export, and delete a project with a confirmation for destructive actions.
- A useful starter project or short first-run onboarding, without blocking users behind a tutorial.
- Import a Neest project file.

### Editor shell

The main editor contains:
- **Top floating bar:** project name, save indicator, undo/redo, 2D/3D/view switching, and project/export actions.
- **Floating left tool rail:** select, wall, room/rectangle, opening, object/library, measure, and relevant editing tools. Use icons with tooltips and visible active states.
- **Contextual library panel:** collapsible and resizable, used for construction items, furniture, fixtures, materials, textures, and saved/favourite items.
- **Contextual inspector:** shown when an item is selected; fields depend on the selected item. It should not take over the entire application.
- **Canvas/navigation controls:** zoom, fit plan, reset view, grid/snap toggles, and optional minimap only if it adds real value.
- **Bottom/status strip:** selected object info, current tool, unit readout, and helpful hints such as snap target or save status.
- **Mode-specific overlays:** dimensions, room labels, 3D display settings, render controls, and walkthrough controls appear only when relevant.

### Miro-inspired floating UI

Panels should float above the canvas with subtle borders, restrained shadows, thoughtful translucency only where legible, and draggable/collapsible behavior where useful. Keep the canvas visually dominant. The user must be able to hide all editor chrome for a **clean/no-interface view**. Provide a clear way to restore controls from no-interface view, such as Esc or a small unobtrusive edge control.

Support both dark and light themes, with a manually selectable theme and an optional system preference. The plan canvas itself should remain easy to read in either theme. Use semantic design tokens for backgrounds, surfaces, text, borders, accents, selection, snap guides, warning states, and dimension annotations.

### Interaction details

- Use consistent selection outlines, hover feedback, keyboard shortcuts, and contextual right-click menus where appropriate.
- Clicking the empty canvas clears selection when the active tool allows it.
- Escape cancels the in-progress operation or returns to selection mode.
- Space-drag pans; wheel/trackpad zooms about the cursor if practical; provide visible fallback controls.
- Keep keyboard focus visible and labels accessible; do not rely on color alone to convey state.
- Tooltips should describe both tool name and shortcut where applicable.
- Destructive actions require a confirmation when they would remove complex geometry or multiple objects.

## 7. Core project data model

Design a typed, versioned domain model before building UI features. Persist only meaningful project data, not transient UI state.

A project should include at least:
- `id`, `name`, schema version, created/modified timestamps, units, project settings, and optional thumbnail.
- Apartment bounds / canvas extent and default wall settings.
- Wall nodes and wall paths/segments.
- Rooms and derived room boundaries/areas/perimeters.
- Doors, windows, and other openings.
- Furniture, fixtures, appliances, decor, and other placed library instances.
- Material definitions and references to materials assigned to walls, floors, ceilings, doors, windows, and objects.
- Layer/visibility/lock information where useful, without making the app needlessly complex.
- Camera/view presets and render settings when useful to retain the chosen presentation.

Use real-world coordinates internally. Choose a consistent canonical unit (meters are recommended) and convert to display/export units at the boundaries. The camera, SVG, and screen coordinate systems must never become the source of truth for geometry.

Suggested core entities (rename if a better typed design is warranted):

- `Project`
- `WallNode`
- `WallSegment` / `WallPath`
- `Room`
- `Opening` (`door`, `window`, or related type)
- `AssetDefinition`
- `PlacedObject`
- `MaterialDefinition`
- `TextureDefinition`
- `CameraPreset`
- `RenderSettings`

Use stable IDs, explicit types, schema-version migrations, and validation for project import. Derive data such as room boundaries or wall meshes from the structural model where possible rather than storing redundant copies. If derived caches are stored for speed, make them disposable and regenerable.

### Coordinate conventions

- Use a documented world-axis convention for 2D and 3D.
- Use metres internally, with UI conversion for mm, cm, m, inches, and feet as applicable.
- Persist object transforms, rotation, dimensions, wall parameters, materials, and opening positions as numeric values, not formatted display strings.
- Avoid accumulating floating-point drift. Use tolerances for geometric comparisons and snap calculations.

## 8. Build mode and 2D drafting engine

The 2D editor is a primary feature, not a decorative diagram. Give it reliable geometry, clear feedback, and a smooth interaction model.

### Tools to implement

At minimum, implement:
1. Select / move / multi-select where practical.
2. Draw straight wall.
3. Draw connected wall chains with snapping to nodes/endpoints/intersections.
4. Draw room/rectangle as a quick way to create a closed set of walls.
5. Edit wall endpoints and dimensions.
6. Split/cut wall at a point.
7. Delete selected segment/object.
8. Add, move, resize, and rotate doors and windows along a wall.
9. Place, rotate, move, duplicate, and delete library objects.
10. Measure distance / display dimensions.
11. Pan, zoom, fit-to-plan, and toggle grid/snap.
12. Undo/redo.

### Wall requirements

Walls need editable properties for:
- Length (or path length for curved walls).
- Thickness.
- Height.
- Elevation/base height when needed.
- Type/role (for example, interior partition or exterior apartment boundary, without introducing a full structural engineering system).
- Surface materials on both sides and top where appropriate.
- Lock/visibility state.

Provide intuitive wall editing: endpoint dragging, numeric dimension entry, and the ability to split/cut a wall without accidentally moving neighbouring geometry. When an endpoint is moved, attached wall segments should remain connected according to a clear rule. Make connected-wall behavior predictable and test it.

Support straight walls robustly first. Also design the path model so curved walls are possible. Implement a genuine curved wall tool (for example, an editable quadratic/cubic Bézier centreline approximated into segments for rendering and 3D geometry) if it can be made reliable within the architecture. Curved walls must retain adjustable thickness and height. Do not label a segmented straight polyline tool as a fully editable curve if curve handles are not supported.

### Precision and snapping

- Snap to grid, wall endpoints, midpoints, intersections, wall edges, room corners, and alignment guides.
- Allow grid spacing and snap toggles to be adjusted.
- Offer angle constraints (including 0°, 45°, and 90°) while drawing.
- Show a live measurement preview while drawing or moving a wall.
- Allow exact numeric entry for lengths and key dimensions.
- Use a consistent screen-space threshold for pointer hit testing regardless of zoom.
- Show a clear visual cue for the active snap target.
- Add a lock-walls option to prevent accidental edits to established geometry.

### Topology and room detection

- Closed wall loops should identify rooms.
- Room names, areas, and perimeters should update when walls change.
- Room boundaries should be derived from the wall network and remain consistent when doors/windows are added.
- Handle common apartment layouts, including connected rooms, T-junctions, shared walls, L-shaped spaces, and narrow corridors.
- If ambiguous/self-intersecting geometry cannot be resolved automatically, surface a useful warning and let the user continue editing rather than silently corrupting the plan.

### Dimension annotation

- Display wall lengths while drawing and when selected.
- Provide optional dimension layers for overall dimensions, room dimensions, and selected-wall dimensions.
- Dimension positions and labels must remain legible as zoom changes.
- Allow units and display precision to be controlled in project settings.
- Use a dedicated dimension renderer so annotations can be toggled and exported separately from the geometry.

### 2D view modes

Include a useful set of modes, with clear names and a single project model underneath:
- **Draft:** monochrome technical line work, clean wall outlines, openings, dimensions, and room labels.
- **Furnished plan:** top-down colour/material view with furniture footprints and room finishes.
- **Presentation plan:** a quieter, more polished top-down plan with reduced technical clutter and optional shadows/colours.
- **No-interface / canvas-only:** hides tools and editor chrome for inspection or capture.

Do not merely recolour a single static image. All views must be rendered from the current editable model.

## 9. Room and surface properties

Selecting a room should expose contextual settings such as:
- Room name and optional room type.
- Measured area and perimeter.
- Floor material and colour.
- Ceiling material/colour and visibility options.
- Optional room-level presentation settings.

Rooms need dependable closed polygons and floor surfaces in 3D. For common concave apartment rooms, triangulate polygons correctly. Avoid assuming every room is a rectangle.

Room labels should be optional, editable, and exportable. If the room is derived from wall topology, explain in the UI how to resolve a room that is not being detected.

## 10. Doors, windows, and openings

Openings should be real components attached to a wall path rather than unrelated symbols sitting on top of it.

At minimum support:
- Single door, double door, sliding door, and basic window types.
- Width, height, sill height (for windows), wall offset/position, rotation/orientation based on wall direction, and a small set of style/appearance options.
- Moving openings along their host wall and resizing them, with bounds that prevent nonsensical placement beyond the segment.
- A 2D symbol that reads clearly in a technical plan (including an arc/swing indicator for hinged doors when relevant).
- A corresponding 3D wall opening with a frame/panel/window assembly.

In 3D, openings must create actual wall gaps. Do not simulate a door by placing a door-shaped rectangle on top of a solid wall. Use robust wall splitting/mesh generation around opening intervals, or another reliable geometry approach. Test openings near wall endpoints and multiple openings in one wall. For curved walls, either implement a sensible supported subset or state/document the limitation.

## 11. 3D scene and view modes

Generate a real 3D scene from the same domain model. Changes to walls, openings, furniture, or materials should update the scene without requiring an unrelated manual rebuild action.

### Main 3D requirements

- Orbit/pan/zoom camera with useful constraints and a home/reset view.
- Top, plan/isometric, perspective, and selected-camera views.
- Wall heights and thicknesses that match the model.
- Correct room floor polygons, including concave rooms.
- Real door/window openings and visible frames/panels.
- Furniture and fixtures at accurate dimensions and positions.
- Surface materials applied to the correct wall faces, floor surfaces, objects, and ceilings.
- Lighting with plausible ambient/environment light, adjustable sun/key light, shadows, and exposure.
- Useful wall visibility options such as hide walls, fade walls closest to the camera, or cutaway/section presentation when practical.
- A visual-quality switch between smooth interactive viewport mode and higher-quality render settings.

Use physically based materials where possible. Provide sane defaults: a clear neutral lighting setup, shadows that do not make the plan too dark, and a background that helps furniture silhouettes stand out.

### Camera presets

Allow users to save, name, update, and switch between useful camera views. Store camera position, orientation/target, lens/FOV where relevant, and any relevant visibility mode. Camera presets should survive refresh and be part of the project.

### First-person walkthrough / guest view

Implement an accessible walkthrough mode:
- Enter first-person view from a chosen start point or by repositioning the camera.
- Mouse look on desktop; sensible touch look and movement on mobile.
- Clear movement hints and a quick exit back to the editor.
- Collision/keep-inside behavior that prevents easy movement through walls where achievable.
- A dedicated **Guest View** that hides editor tools, selection handles, measurements, and editing controls. It is for viewing, not editing.
- Let the user choose an initial camera and save or export a guest-viewable version.

For sharing without a backend, export a portable view-only HTML package or single HTML file where technically feasible, including its generated geometry and necessary local assets. The recipient should not need a Neest account. If true single-file packaging is impractical, provide a ZIP package containing a clear `index.html` and all assets. Do not generate an export that references temporary blob URLs or files from the creator's local browser storage.

## 12. Object and furniture library

Build a browsable, searchable, categorized, and useful built-in library. Quality and editable utility matter more than a fake catalogue count.

### Categories

Include categories such as:
- Construction: wall types, columns/pillars, door frames, windows, and simple partitions.
- Living room: sofas, lounge chairs, coffee tables, side tables, media consoles, shelves, bookcases.
- Bedroom: single/double/queen/king bed variants, bedside tables, wardrobes, dressers, mirrors.
- Dining: tables, dining chairs, stools, bar tables.
- Kitchen: counters, base/wall cabinets, islands, sinks, cooktops, ovens, fridges, dishwashers.
- Bathroom: toilets, vanities, sinks, showers, bathtubs, towel rails, mirrors.
- Office: desks, office chairs, task lights, filing/storage units.
- Storage: cabinets, drawers, open shelves, utility storage.
- Lighting: ceiling lights, pendants, floor/table lamps, wall lights.
- Decor: rugs, curtains/blinds, artwork, plants, vases, books, cushions.
- Electronics: televisions, monitors, speakers, air-conditioning units, and other common household devices.
- Generic primitives/custom objects for items not represented in the catalogue.

The initial shipped library should contain a meaningful working set—target at least 30 distinct functional assets across several categories—and enough material/colour variety to make the editor genuinely useful. Do not pad it with duplicated cards that all insert the same object.

### Asset behavior

Every placeable asset must have:
- A stable asset ID and category.
- A preview/thumbnail.
- A usable 2D footprint/symbol.
- A corresponding 3D mesh or a clearly documented placeholder geometry that is intentionally designed, not broken or missing.
- Default dimensions and editable width/depth/height when the geometry supports it.
- A pivot/origin that makes placement and rotation predictable.
- A default material assignment and optional material slots.
- Asset source and licence metadata when sourced externally.

Support search, category filters, favourites, recently used, and drag-and-drop or click-to-place. While placing, show a transparent preview following the cursor and snap/alignment feedback. After placement, support duplicate, rotate, numeric transform editing, delete, and object locking.

Use curated, properly licensed open assets where feasible. Do not scrape competitor libraries or bundle proprietary assets without permission. If you need to create initial assets procedurally, build a coherent range of parametric furniture and fixtures with distinct silhouettes and adjustable dimensions. Store external assets locally in the project distribution; the app must not depend on a remote model URL to display its built-in library.

### Custom / imported objects

If practical, allow importing GLB/GLTF models from the user's computer, validating the file, showing a preview, and adding them to the project/library. Imported binaries should be stored locally in IndexedDB and included in project export. If this feature is deferred, keep the asset system designed for it and document the limitation.

## 13. Global material, colour, and texture system

Build a centralized material manager, not scattered colour-picker state on each object.

### Material library

Provide categories such as:
- Paint and wall finishes.
- Concrete, plaster, and stone.
- Wood and veneer.
- Tile and mosaic.
- Marble and other natural stone.
- Metal.
- Glass.
- Fabric and upholstery.
- Leather.
- Rugs and woven surfaces.
- Laminate and composite finishes.
- Solid colours and custom palettes.

Each material definition can contain a display name, category, base colour, roughness, metalness, optional texture maps (base colour/albedo, normal, roughness, ambient occlusion, height where supported), UV scale/repeat, preview swatch, source/licence metadata, and editability flags. Provide a sensible fallback when optional maps are missing.

### Global / linked assignments

- A material is a reusable entity; placed surfaces/objects reference its ID.
- Editing a shared material updates every linked use immediately.
- Allow a user to duplicate a material to create a variation.
- Allow an explicit per-instance override where appropriate, while making it obvious that it is no longer linked to the shared material.
- Support assigning a material to one surface, both sides of a wall, all walls of a selected type, every matching asset instance, a room floor, or a selected group when practical.
- Make “apply to all linked surfaces” behavior clear. Avoid surprise global changes when the user only intended to change one object.
- Include recent materials and favourites, a colour picker, colour input accepting HEX/RGB, and quick swatches.

### Texture quality and licensing

Ship a useful starter texture library. You may combine procedural textures generated in code with locally bundled open-license/CC0 textures, such as assets from sources like Poly Haven, provided individual assets are actually licence-checked and attribution/metadata is included where required. Do not simply hotlink textures from a third-party server. Ensure the app works offline after initial load.

Texture tiles should repeat cleanly when possible. Allow scale/rotation adjustments and a simple preview on a meaningful surface, rather than only displaying a colour swatch.

### Material UX

Selecting a surface opens a compact material inspector with swatch/preview, material name, colour, texture scale, roughness, and relevant parameters. The library panel should support search, categories, preview, apply, duplicate, rename, and delete where safe. Prevent deleting a material that is in use without offering a replacement/unlink flow.

## 14. Rendering and visualization

Provide built-in rendering options without relying on a paid cloud service.

### Interactive viewport

- Real-time 3D with reasonable PBR materials, soft shadows, ambient/environment light, exposure control, and camera controls.
- A quality/performance preset: Draft / Balanced / High.
- Toggle ceilings, walls, room labels, dimensions, helper overlays, and selected categories of objects.
- Scene settings for background, light direction/intensity, time-of-day-like brightness, and exposure.

### Render capture

- Render the current 3D camera view to PNG at practical export resolutions.
- Allow an output aspect ratio or preset such as 16:9, 4:3, and square.
- Include options for lighting, shadows, transparent/solid background where technically supported, and whether helper overlays are included.
- Keep the exported viewpoint identical to the chosen camera, not a surprise camera angle.
- Make clear that the first version is browser real-time rendering, not a cloud-based photorealistic path tracer.

Do not claim cinema-grade path tracing unless actually implemented. Focus on consistent composition, good material response, stable lighting, and a useful result.

## 15. Technical drawing and export system

Exports are a core product capability and must be treated as real deliverables, not just screenshots of the editor.

### Native project

- Export/import a versioned `.neest` project file (JSON or ZIP-based format with a manifest and binary asset references).
- Validate imports, handle unsupported schema versions cleanly, and reject corrupt or oversized assets with helpful errors.
- Provide duplicate project and recovery-friendly local storage behavior.

### 2D export

Support:
- PNG with selected scale/resolution and optional background.
- SVG that remains vector-based and has selectable/renderable dimension text.
- PDF technical plan with vector linework where possible.
- DXF export for CAD interoperability, using documented mapping for walls, openings, dimensions, and room labels.

Provide a print/export sheet setup with:
- Paper size presets such as A4 and A3, plus Letter if practical.
- Landscape/portrait orientation.
- Output scale presets such as 1:20, 1:50, and 1:100, plus fit-to-page.
- Unit selection and display precision.
- Overall dimensions, room dimensions, room labels/areas, opening symbols, title/project name, scale indicator, and optional legend.
- Line weights that remain legible at the selected output scale.
- Margins and a preview before download.

A technical plan export must come from vector geometry, not from stretching a screenshot. Do not use a fake dimension scale. If an export type is not implemented yet, do not show it as an active option.

### 3D export

- PNG image of the current chosen 3D camera angle.
- GLB/glTF export of the scene with geometry, transforms, and supported materials.
- Guest-view walkthrough package as described above.
- Optional JSON summary/report of room areas and object/material inventory if it can be implemented cleanly.

Use descriptive filenames with project name, date, and view/output type. Export dialogs should show format, paper/size, included annotations, and estimated output dimensions before generation.

## 16. Local persistence and future Cloudflare readiness

This iteration has no remote backend. It must function without authentication.

### Local behavior

- Store projects, preferences, material library changes, and imported assets in IndexedDB.
- Autosave after meaningful edits, with a debounce that does not save on every raw pointer event.
- Show saving/saved/error states and a last-saved timestamp.
- Save a recoverable working state after unexpected refresh/crash when feasible.
- Support multiple local projects, rename, duplicate, delete, import, and export.
- Keep a project opening path that works offline after the app and assets have loaded.

### Future backend seam

Prepare a small repository/storage interface (for example, `ProjectRepository`) so local IndexedDB storage can later be replaced or supplemented by a Cloudflare-backed implementation. Keep domain logic independent from storage. Do not write pretend Cloudflare requests, fake authentication, hardcoded API endpoints, or server-shaped code that is unused. Document the likely future integration points, but do not implement the backend in this version.

## 17. Undo, redo, validation, and edit history

Undo/redo must work for the operations a user naturally expects to reverse: drawing, moving, deleting, resizing, splitting walls, adding/moving openings, placing/deleting/rotating objects, room property changes, and material assignment changes.

- Implement a command/transaction-based history or another reliable model-level history system.
- Group drag gestures into one history entry, not hundreds.
- Avoid storing transient pointer movement as separately undoable operations.
- Keep the history bounded to a reasonable memory budget.
- Ensure redo is cleared when a new edit occurs after undo.
- Undo/redo should update both 2D and 3D views and persist the resulting state correctly.

Validate user input and geometry at model boundaries. Show helpful errors for invalid numeric values, impossible dimensions, invalid imports, or geometry that cannot be rendered. Never silently discard a user's edit.

## 18. Responsive behavior and mobile scope

On mobile devices:
- Open recent projects and new projects.
- Inspect the plan in 2D and 3D.
- Pan, zoom, orbit, and enter/exit Guest View.
- Select a furniture object or room and modify basic properties/material colours.
- Perform basic move/rotate/place actions where touch interaction remains reliable.
- Take/export a 3D screenshot if browser capabilities permit.

For advanced wall editing, precise dimension drafting, DXF/PDF sheet controls, and other complex desktop workflows, show a clear, friendly desktop-required explanation and do not render crowded miniature toolbars. Do not let mobile omissions compromise the desktop version.

## 19. Suggested implementation phases

Work through phases in order. Keep the app runnable after each phase. Adjust the order only when dependencies or repository constraints make that clearly better.

### Phase 0 — Repository assessment and foundation

- Inspect the repo and document the actual starting state.
- Set up the app, strict TypeScript, styling tokens, lint/test/build scripts, and app shell.
- Implement the home/project-launcher shell and empty editor with coherent dark/light themes.
- Add a seeded demo apartment only as a genuine editable model, not as a static screenshot.

### Phase 1 — Domain model and local project lifecycle

- Implement the typed project schema, validation, versioning, IndexedDB persistence, project creation/open/rename/duplicate/delete, import/export of the native project format, and autosave status.
- Implement a clean command layer and working undo/redo for initial model operations.

### Phase 2 — Functional 2D editor

- Implement camera/pan/zoom, grid, selection, wall drawing, connected wall chains, room rectangle creation, numeric dimensions, wall selection and editing, endpoint snapping, split/delete, room detection/labels, and dimensions.
- Add opening placement and editing in 2D.
- Make common workflows feel reliable before expanding the catalogue.

### Phase 3 — 3D synchronization

- Generate room floors and wall geometry from the same model.
- Add actual door/window wall cutouts, 3D furniture, basic PBR materials, orbit camera, top/isometric/perspective presets, and selectable object inspection.
- Verify that changes in 2D instantly reflect in 3D and vice versa where supported.

### Phase 4 — Asset and material libraries

- Add a meaningful starter object library with thumbnails and functional 2D/3D representations.
- Add category/search/favourites/recent items and placement/rotation/resize/duplicate workflows.
- Add shared material entities, colour controls, texture categories, global assignments, and linked material editing.

### Phase 5 — Presentation, walkthrough, and exports

- Add polished 2D view modes, no-interface mode, camera presets, walkthrough/Guest View, render capture, native asset-aware export, SVG/PNG/PDF/DXF 2D output, and GLB output.
- Add the portable guest-view export if it can be done reliably; otherwise deliver the best functional package format and document the boundary clearly.

### Phase 6 — Hardening and quality

- Test common wall topologies, opening bounds, import failures, persistence, undo/redo, and exports.
- Address performance, responsiveness, keyboard accessibility, and browser edge cases.
- Polish empty states, error handling, onboarding, and documentation.

**Do not finish merely because all phases are listed.** Implement as much as possible in the current work session, prioritizing an end-to-end working 2D-to-3D loop, robust persistence, useful assets/materials, and real exports over superficial breadth.

## 20. Suggested project structure

Adapt to the existing repository, but keep responsibilities clear. For example:

```text
src/
  app/                 # app shell, routing, providers
  components/          # shared UI primitives and overlays
  features/
    projects/          # launcher, project lifecycle
    editor/            # shell, tool state, keyboard shortcuts
    plan-2d/           # SVG canvas, tools, dimensions, snapping
    scene-3d/           # R3F/Three scene, generated geometry, cameras
    walkthrough/       # first-person and guest view
    library/            # asset browser, object placement
    materials/          # material manager and assignment flows
    exports/            # PDF/SVG/PNG/DXF/GLB/guest package
  domain/
    model/              # typed entities and schemas
    geometry/           # intersections, offsets, rooms, triangulation
    commands/           # edit commands and undo/redo
    validation/         # invariants and repair diagnostics
  storage/
    indexeddb/          # local project repository
    migrations/         # schema migrations
  data/
    assets/             # asset manifest and starter catalogue
    materials/          # starter materials and textures
  styles/
  test/
```

Avoid one enormous editor component. Keep geometry and model-editing operations testable outside React. Avoid excessive abstraction for its own sake.

## 21. Engineering and geometry standards

- TypeScript strict mode should be enabled; do not broadly use `any` to bypass domain modelling.
- Separate pure geometry functions from rendering and UI event handlers.
- Unit-test critical geometry: line intersections, offsets, wall thickness, snapping tolerances, opening intervals, room polygon detection, area/perimeter, concave room triangulation, and unit conversions.
- Use stable IDs rather than array indices as entity identity.
- Ensure openings remain attached when the host wall changes. If a wall is split, define and test how openings and IDs are reassigned.
- Avoid non-manifold or self-intersecting wall meshes for common cases. Add diagnostics for invalid junctions rather than hiding geometry errors.
- Use disposal patterns for Three.js geometries, materials, textures, render targets, and object URLs to prevent memory leaks.
- Use lazy loading for heavier library panels or import/export dependencies when beneficial.
- Keep all exports deterministic and derived from the saved project model.
- Do not rely on remote APIs for core functionality.
- Respect browser security limits and validate all imported file types/sizes.

## 22. Visual design direction

The app should feel like a modern creative tool: calm, precise, slightly tactile, and professionally designed.

- A large neutral canvas is the centre of attention.
- Floating panels with clear hierarchy, compact controls, and deliberate spacing.
- Strong typography and carefully aligned numerals, particularly dimensions.
- A restrained accent colour for selection, active tools, snapping, and primary actions.
- Rounded corners used consistently but not excessively.
- Subtle animations for panel opening, mode switching, and object placement; avoid animations that delay precision work.
- Helpful onboarding and empty states, not large marketing-style hero sections inside the editor.
- Dark mode must preserve line contrast and dimension readability; light mode must avoid eye-searing pure-white chrome.
- Keep the no-interface view visually clean enough for review or capture.

Do not copy a reference product's exact visual design. Create a distinct Neest visual identity.

## 23. Accessibility and reliability

- Use semantic buttons, form labels, keyboard-focus states, and accessible names for icon-only controls.
- Critical actions should be keyboard reachable.
- Do not make colour the only signal for selection, invalid geometry, or active tools.
- Support reduced-motion preferences where applicable.
- Give clear feedback during imports, exports, saves, and expensive operations.
- Report errors in plain language and provide a recovery path when possible.
- Avoid browser alerts for routine application UI; use consistent in-app dialogs/toasts.

## 24. Acceptance criteria

The implementation is not considered successful unless the relevant implemented features pass these real-use checks:

### Project lifecycle
- I can create a project, name it, reload the browser, and reopen the same project with its geometry, materials, objects, and settings intact.
- I can create multiple projects, rename/duplicate/delete one, and see accurate recent-project metadata.
- Autosave status accurately reflects success/failure and does not flicker on every pointer movement.
- I can export and re-import a project without losing the supported parts of its content.

### 2D plan editing
- I can draw connected walls with grid/endpoint snapping and live measurements.
- I can set wall thickness and height, move endpoints, enter exact dimensions, split a wall, and delete a segment.
- I can make an enclosed non-rectangular room and see its correct area/perimeter.
- I can place and move an opening on a wall and see a readable 2D symbol.
- I can undo and redo meaningful operations without breaking the geometry.
- Pan/zoom remains smooth and pointer hit-testing remains useful at different zoom levels.

### 3D model
- The same apartment model appears in 3D with correctly proportioned walls and floors.
- Doors/windows create actual openings.
- Furniture positions, dimensions, rotations, and materials agree with 2D/project data.
- A material change is visible in 3D without reloading the app.
- Orbit, pan, zoom, reset camera, view presets, and no-interface/Guest View work as described.

### Library and materials
- I can search and filter the included asset library, place objects, rotate/move/resize/duplicate them, and see each as a meaningful 2D footprint and 3D object.
- Shared material edits update all linked assignments; duplicating a material allows independent variation.
- The starter catalogue includes real category variety and no broken thumbnails or dead entries.
- The project still renders its built-in assets when offline.

### Exports
- SVG/PNG output matches the active plan and visibility/annotation settings.
- PDF output is proportioned correctly on the chosen paper size and uses vector linework where supported.
- DXF output opens as valid CAD geometry with documented supported entities and scale.
- 3D PNG capture matches the chosen camera angle.
- GLB/glTF contains the supported scene geometry and transforms.
- Any guest-view package opens without relying on the creator's browser storage or temporary URLs.

### Responsive UX and quality
- Desktop editor works at the target viewport without overlapping critical controls.
- Mobile inspection and walkthrough controls are usable, with advanced features clearly labelled as desktop-only.
- Dark and light themes both have sufficient contrast.
- Type checking, tests, and production build pass.
- README setup and feature descriptions match what is genuinely implemented.

## 25. Required final handoff

When you finish this implementation session:

1. Summarize the actual features implemented and the key architectural decisions.
2. List the exact commands to install, run, test, lint, and build the app.
3. Report test/build results truthfully.
4. List any features not completed, with concise reasons and the next best implementation step.
5. Explain how local persistence works and where project files can be exported/imported.
6. Include asset licensing/source notes and any limitations in PDF/DXF/GLB or guest-view export.

**Final instruction:** Start by inspecting the repository, then begin implementation. Do not respond with only a plan. Build Neest as a coherent, working, local-first 2D/3D apartment floor planner.
