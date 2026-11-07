# Neest — notes for Claude

Read [KNOWLEDGEBASE.md](KNOWLEDGEBASE.md) first (architecture, conventions, pitfalls, recipes, status) and
[AGENTS.md](AGENTS.md) for the ground rules. Product brief: `_Prompt/prompt.md`.

Commands: `npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run test:e2e`.
On Windows, `start-neest.bat` installs dependencies if needed and starts the dev server.

Work in the dev server is kept in browser storage as you go; a project's file in `projects/` is written only when
the user saves (Ctrl+S or the top-bar Save button). Editing a file there updates open browsers live; don't leave
test projects behind in that folder.

Dev debug hooks (dev builds only): `window.__NEEST__` (`project`, `editor` stores) and
`window.__NEEST_LIVE__.current` (live three.js renderer/scene/camera).

The dev machine is Windows without Python: use Node for scripted file edits.
