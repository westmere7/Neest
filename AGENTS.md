# Agent instructions

Start with **[KNOWLEDGEBASE.md](KNOWLEDGEBASE.md)** — architecture, conventions, data model, algorithms, known
pitfalls, recipes and current status. Product requirements: `_Prompt/prompt.md`.

Ground rules:
- Keep `src/domain/**` pure (no React/DOM). Edit the model only through `src/domain/commands` via
  `useProjectStore.getState().execute(...)` (or `begin/preview/commit` for drags).
- Metres everywhere internally; plan +y is down; plan rotation θ ↦ three.js `rotation.y = -θ`.
- 2D, 3D and exports must all derive from `Project` + `derivePlan` — never a parallel geometry copy.
- Run `npm test` and `npm run typecheck` before finishing; add tests for geometry/command changes.
- Update KNOWLEDGEBASE.md (status, pitfalls, conventions) when you change behaviour.
- No backend, auth or network dependencies for core features. The one exception (decided by the owner) is optional
  live editing: `cloud/` (Cloudflare Worker + Durable Objects) and `src/sync/`. Everything else must keep working
  with no server; live editing appears only when a sync server is configured (cloud/README.md).
- `projects/` is shared with the team through git: remove projects you created only for testing.
- New floating panels must be registered in `src/components/layoutInsets.ts` so views frame around them, and new
  top-level panels, bars, dialogs and popups added to the interface-scale list in `components.css` (popups placed at a
  screen position use `toUi`; see KNOWLEDGEBASE §16 "Interface scale").
- Adding library items or materials: follow **KNOWLEDGEBASE.md §12 "Asset rules"**. In short:
  - Put new content in a pack (`packs/<id>.pack.ts`). Never rename or remove existing item ids.
  - Every item needs a valid room, type and shelf, a specific name, a description and 3+ tags.
  - Give items a Vietnamese `price` in VND (branded: the researched listed price; props and building parts: none).
  - All vegetation goes in `category: 'plants'` with `plant: PLANT_SPECIES[...]`.
  - Branded items are real models sold in Vietnam, with `brand`, in `branded-*.pack.ts`.
  - Structure and built furniture open in the shape editor when they have components to resize: it makes
    variants (wider opening, lower soffit, smaller radius), never edits single parts. Give spec-built families
    `params` for those components, a `handle` for geometric lengths (radius, leg, drop), real divider and shelf
    panels, props in their own slot with `plan: false`, and a stable part order (§12 rule 13, packs/README.md
    "Make items editable").
  - Then run `npm run thumbs` and keep the generated `public/thumbs` and `public/swatches` files.
  - `src/data/assets/assetRules.test.ts` enforces these rules.
