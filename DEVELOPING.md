# Developing Neest

For anyone changing the app itself (and their AI assistant). Read **KNOWLEDGEBASE.md** (architecture, conventions,
pitfalls, history) and **AGENTS.md** (ground rules) first.

## Every time

1. **Pull first**: `git pull` on `main`, then merge `main` into your branch (`Danh`, `Ngan`). Work started on an old
   copy is what causes merge conflicts. Merge `main` in again before pushing if it moved.
2. `npm install` (after a pull that changed `package.json`), then `npm run dev`.
3. Before pushing: `npm test`, `npm run typecheck`, `npm run lint`.
4. Update KNOWLEDGEBASE.md when behaviour changes, and add a history entry **at the end** of the numbered list. Two
   people adding entries at the same time clash in a merge: whoever merges renumbers the later ones (the base keeps its
   numbers).
5. `projects/`: a project file is written only when you Save (Ctrl+S) in the dev server. Don't leave test projects
   there.

## Where things are

| Area | Code |
| --- | --- |
| Project model, commands, geometry | `src/domain/` (pure: no React or DOM) |
| Undo history and the shared document form | `src/domain/sync/` (ops, document vs per-person view) and `src/state/projectStore.ts` |
| Live editing in the app (session, sign-in, Live button, account panel) | `src/sync/` |
| Live-editing server (Cloudflare Worker + Durable Objects) | `cloud/` — see `cloud/README.md` |
| Library items and materials | `packs/` — see `packs/README.md` and KNOWLEDGEBASE §12 |
| Dev and deploy scripts | `tools/` |

## Live editing on your own machine

`npm run dev` uses the team's server (`.env.development`): sign in with your own account under "Shared with the
team" and you see and edit the team's projects, as on the website. Your own projects stay in this browser.

A shared project is saved on the team server as you edit (the top bar says "Saved to the team"); Save (Ctrl+S) does
nothing more. While it is open in `npm run dev`, its file in `projects/` is a **two-way working copy**:

- the app keeps the file at the team's current version (a moment after any change, anyone's);
- when you or your assistant change the file, the app applies just those changes (an undo step, "Changes from the
  project file") and sends them to the team. Changes others made meanwhile are kept.

So to have Gemini or Claude change a shared layout: open the project in `npm run dev` (signed in), let the assistant
edit the file (re-reading it right before each change), and watch it appear. Shared projects' files are git-ignored
(see `.gitignore`): never commit them. With the project closed, edits to the file are picked up the next time it is
opened on that computer.

To work on the live-editing server itself, run a local copy with local test accounts (the team's real passwords
and the server's signing key live only on Danh's PC; git ignores them):

0. Put `VITE_NEEST_SYNC_URL=/sync` in `.env.development.local` (git-ignored) and restart `npm run dev`.
1. `npm run cloud:accounts` once — makes **local** test accounts and passwords on your machine
   (`cloud/accounts.local.json`).
2. `npm run cloud:dev` (room server on port 8787) next to `npm run dev`; sign in with a local account.
3. A second browser (or profile) is a second person.

## Deploying (Cloudflare)

**The app deploys itself**: every push to `main` on GitHub makes Cloudflare build it (`npm run build`) and publish it
at https://neest.nguyentuandanh-7.workers.dev, about two minutes later. Pushes to `Danh` / `Ngan` don't deploy, so
only merge into `main` what should go live. A failed build leaves the previous version up; see it under the `neest`
Worker → Deployments / Builds in the Cloudflare dashboard. An open copy of the site shows the new version on its
second load (offline cache).

The rest needs access to the Cloudflare account (ask Danh for an invite under Manage account → Members), then
`npx wrangler login` once.

- `npm run deploy:app` — deploys the app by hand from your machine (not needed after a push to `main`).
- `npm run cloud:deploy` — the room server, **with the account secrets of the machine it runs on**. Run it only from
  Danh's PC: from anywhere else it would replace everyone's passwords and sign everyone out.
- `npm run cloud:share -- <project file>` — puts a project from `projects/` on the team's shared list (Danh's PC:
  uses the server's signing key).
