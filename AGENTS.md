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
- No backend, auth or network dependencies for core features.
- `projects/` is shared with the team through git: remove projects you created only for testing.
- New floating panels must be registered in `src/components/layoutInsets.ts` so views frame around them.
- Adding library items or materials: follow **KNOWLEDGEBASE.md §12 "Asset rules"**. In short:
  - Put new content in a pack (`packs/<id>.pack.ts`). Never rename or remove existing item ids.
  - Every item needs a valid room, type and shelf, a specific name, a description and 3+ tags.
  - Give items a Vietnamese `price` in VND (branded: the researched listed price; props and building parts: none).
  - All vegetation goes in `category: 'plants'` with `plant: PLANT_SPECIES[...]`.
  - Branded items are real models sold in Vietnam, with `brand`, in `branded-*.pack.ts`.
  - Then run `npm run thumbs` and keep the generated `public/thumbs` and `public/swatches` files.
  - `src/data/assets/assetRules.test.ts` enforces these rules.
