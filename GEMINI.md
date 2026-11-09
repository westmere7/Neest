# Neest — notes for Gemini

Read [DEVELOPING.md](DEVELOPING.md) (workflow), [KNOWLEDGEBASE.md](KNOWLEDGEBASE.md) (architecture, conventions,
pitfalls, recipes, status) and [AGENTS.md](AGENTS.md) (ground rules) before changing anything. Product brief:
`_Prompt/prompt.md`.

Commands: `npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`.

Always `git pull` and merge `main` into your branch before starting. Add KNOWLEDGEBASE history entries at the end of the
numbered list. Never run `npm run cloud:deploy` (it uploads this machine's account secrets); `npm run deploy:app` is
fine with Cloudflare access. Pushing to `main` publishes the app automatically, so merge only finished, checked work
into `main`.

Layouts of projects shared with the team (e.g. 60LTN) live on the team server. To change one, edit its file in
`projects/` while the project is open in `npm run dev`: read the file right before every change (the app keeps it at
the team's latest version), change only what you mean to, and keep the JSON valid. The app sends your changes to the
team. Never commit those files (they are git-ignored).
