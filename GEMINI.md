# Neest — notes for Gemini

Read [DEVELOPING.md](DEVELOPING.md) (workflow), [KNOWLEDGEBASE.md](KNOWLEDGEBASE.md) (architecture, conventions,
pitfalls, recipes, status) and [AGENTS.md](AGENTS.md) (ground rules) before changing anything. Product brief:
`_Prompt/prompt.md`.

Commands: `npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`.

Always `git pull` and merge `main` into your branch before starting. Add KNOWLEDGEBASE history entries at the end of the
numbered list. Never run `npm run cloud:deploy` (it uploads this machine's account secrets); `npm run deploy:app` is
fine with Cloudflare access.
