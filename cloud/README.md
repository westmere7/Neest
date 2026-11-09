# Neest live rooms (multi-user editing)

A Cloudflare Worker with one Durable Object per shared project (`ProjectRoom`, SQLite storage). It keeps the
shared project, puts everyone's changes in one order and relays pointers and selections. The app works without
it; live editing appears only when a sync server is configured.

Everything fits the **Workers Free** plan (SQLite-backed Durable Objects are included). Nothing here costs money
unless the account is upgraded.

## Run locally

```bash
npm run cloud:dev
```

Starts the room server on http://127.0.0.1:8787 (data in `.wrangler/`, ignored by git). With `npm run dev`
running too, the app reaches it through the Vite proxy at `/sync`; the Live button (people icon, top bar) shares a
project and gives a link. Open the link in another browser (or another profile) to be a second person.

## Deploy (only when you decide to)

Wrangler on the dev machine is signed in to the Cloudflare account (`npx wrangler whoami`). Two commands:

1. `npm run cloud:deploy` — the room server, at `https://neest-sync.nguyentuandanh-7.workers.dev`.
2. `npm run deploy:app` — builds the app (`.env.production` points it at that server) and uploads `dist/` to
   Cloudflare Pages as project `neest` (first run creates it; the site is `https://neest.pages.dev`).

Both are free-plan only. Another account: change `.env.production` to its `neest-sync.<subdomain>.workers.dev`.
Without `VITE_NEEST_SYNC_URL` a production build hides live editing.

## How it works

- `POST /rooms {doc}` creates a room from the shared form of a project (`src/domain/sync/doc.ts`) and returns a
  room id and a key. The link is `#/live/<room>/<key>`; the key stays in the URL fragment. Whoever has the link
  can edit; the room stores only the key's SHA-256.
- `GET /rooms/:room/doc?key=` returns the project and its change number; the WebSocket `/rooms/:room/ws?key=`
  then carries only changes (`src/domain/sync/protocol.ts`): the room numbers each batch, applies it (last
  writer wins per property) and sends it to everyone, the sender included. Batches resent after a reconnect are
  recognised by id and not applied twice. Every 500 changes the room writes a snapshot.
- The client (`src/sync/live.ts`) applies others' changes except on properties it has unconfirmed changes to
  (those come later in the room's order and win), re-applies its own when they come back, and resends unconfirmed
  ones after reconnecting.

## Not yet

Accounts and invitations (access is by link only), a list of shared projects on the server, offline edits
surviving a page reload, version history, and imported 3D models (they stay in the sharer's browser).
