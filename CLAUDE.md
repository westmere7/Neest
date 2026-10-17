# Neest — notes for Claude

Read [KNOWLEDGEBASE.md](KNOWLEDGEBASE.md) first (architecture, conventions, pitfalls, recipes, status) and
[AGENTS.md](AGENTS.md) for the ground rules. Product brief: `_Prompt/prompt.md`.

Commands: `npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run test:e2e`.
On Windows, `start-neest.bat` installs dependencies if needed and starts the dev server.

Projects opened in the dev server are mirrored to `projects/` (see projects/README.md). Editing a file there
updates open browsers live; don't leave test projects behind in that folder.

Dev debug hooks (dev builds only): `window.__NEEST__` (`project`, `editor` stores) and
`window.__NEEST_LIVE__.current` (live three.js renderer/scene/camera).

The dev machine is Windows without Python: use Node for scripted file edits.
