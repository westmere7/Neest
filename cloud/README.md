# Neest live editing (multi-user, team accounts)

Two Cloudflare Workers, both on the **Workers Free** plan:

- **`neest-sync`** (`wrangler.jsonc`, `src/`) — sign-in for the team's accounts, the list of shared projects
  (`Directory` Durable Object) and one `ProjectRoom` Durable Object per shared project (SQLite storage): it keeps
  the project, puts everyone's changes in one order and relays pointers, selections and changes in progress.
  `https://neest-sync.nguyentuandanh-7.workers.dev`
- **`neest`** (`app.wrangler.jsonc`) — the built app (`dist/`) as static files.
  `https://neest.nguyentuandanh-7.workers.dev`

The app works without either: live editing appears only when a sync server is configured.

## Accounts

Danh (`danh`), Ngân (`ngan`) and Linh (`linh`). `npm run cloud:accounts` (tools/make-accounts.mjs) keeps their
passwords in `cloud/accounts.local.json` and writes the password hashes and the session-signing key to
`cloud/.secrets.json` (uploaded by `npm run cloud:deploy`) and `cloud/.dev.vars` (used by `npm run cloud:dev`).
All three files stay on the machine (git ignores them). To give someone a new password: delete their entry in
`accounts.local.json`, run `npm run cloud:accounts`, then `npm run cloud:deploy`. To add a person: add them to
`PEOPLE` in tools/make-accounts.mjs and do the same.

Sign-in: name (any case) + password → a session token for 30 days, kept in the browser. Ten wrong passwords for an
account lock it for 15 minutes. **Account settings** (the gear by your name on the home page, or "Account settings"
in the Live panel): change your password (needs the current one; at least 4 characters; optionally signs out your
other devices), sign out on other devices, sign out. A password changed in the app lives in the `Directory`; a
reset from this machine (new password in `accounts.local.json` → `npm run cloud:accounts` → `npm run cloud:deploy`)
wins over it — `cloud:accounts` keeps the hashes of everyone whose password in the file is unchanged, so only the
people you changed are reset. The deployed site asks to sign in before anything else; local development opens
straight away and asks only when live editing is used.

## Run locally

```bash
npm run cloud:dev
```

Room server on http://127.0.0.1:8787 (data in `cloud/.wrangler/`, ignored by git); `npm run dev` reaches it through
the Vite proxy at `/sync`. Open a second browser (or profile) to be a second person.

## Deploy

Wrangler on the dev machine is signed in to the account (`npx wrangler whoami`).

1. `npm run cloud:deploy` — the room server, with the account secrets.
2. `npm run deploy:app` — builds the app (`.env.production` points it at the room server) and uploads `dist/`.

Share a project file with the team from this machine: `npm run cloud:share -- projects/<file>.json` (as Danh;
`--owner ngan` for someone else; `--again` to share a second copy of a name already on the list). It mints a session
with the server's signing key from `cloud/.secrets.json`, so nobody signs in on the website for it.

After an app deploy, an open copy shows the previous version once (offline cache) and the new one on the next load.

## How it works

- `POST /auth/login` → token; every other route needs `Authorization: Bearer <token>` (the WebSocket: `?token=`).
  The Worker stamps the account's name and colour on each live connection, so nobody can appear as someone else.
- `POST /rooms {doc, name}` shares a project (shared form from `src/domain/sync/doc.ts`) and lists it for the team;
  `GET /rooms` is the list; `DELETE /rooms/:room` takes it off the list (only whoever shared it). The link
  `#/live/<room>/<key>` also opens it (after signing in); the room stores only the key's hash.
- `GET /rooms/:room/doc?key=` returns the project and its change number; the WebSocket `/rooms/:room/ws` carries
  changes (`src/domain/sync/protocol.ts`): the room numbers each batch, applies it (last writer wins per property)
  and sends it to everyone, the sender included. Batches resent after a reconnect are recognised by id. Every 500
  changes the room writes a snapshot.
- **Changes in progress** (a drag, a slider, a colour picker): the sender sends a `preview` of the change so far
  about 25 times a second; the room relays it without storing it; the others show the newest one per person once
  per frame (not an undo step, not saved). The finished change replaces it; a cancelled one is taken away.
- The client (`src/sync/live.ts`) applies others' changes except on properties it has unconfirmed changes to
  (those come later in the room's order and win), re-applies its own when they come back, and resends unconfirmed
  ones after reconnecting.

## Not yet

Offline edits surviving a page reload, version history, and imported 3D models for people who open a shared
project (their files stay in the sharer's browser).
