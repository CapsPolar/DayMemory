# DayMemory AI

Hexagonal-architecture rewrite, TypeScript + Vite.

## Layout

```
core/                     Pure business logic. No browser APIs, no imports from webapp/.
  models/                 Memory, Agent, Settings — plain TS types
  ports/                  Interfaces adapters must implement
    StoragePort.ts        key/value persistence
    EncryptionPort.ts     encrypt/decrypt
    AiEnginePort.ts       run an agent prompt against text
  services/                VaultService, BufferService, AiService
  utils/date.ts           pure date helpers (see note below)

webapp/                   The only Node project / Vite root.
  adapters/                LocalStorageAdapter, CryptoJSAdapter, OllamaAdapter
                           — implement core's ports
  src/main.ts              Bootstraps adapters -> services, wires up the UI
  public/                  Static assets, served as-is at the site root
  index.html
```

## One deviation from the requested structure

`core/utils/date.ts` wasn't in the original file list. `VaultService`
needs `formatReadableDate()` to build entries (it's not just a UI
concern — buffer-merge and saveEntry both call it), so it lives in core
as a small pure-function module rather than being duplicated in the
webapp. `main.ts` imports the same module for the UI-side date labels.

Also: the earlier discussed "Zod-first" plan for the models was
dropped. Zod is an npm package, and `core/` sits outside `webapp/`'s
node_modules tree — since you asked for a single Node repo confined to
webapp/ (no workspaces), TypeScript can't resolve `zod` from files in
`core/`. Plain TS interfaces plus one small runtime shape-check
(`isTimeline` in `core/models/Memory.ts`) do the same job here without
that friction.

## Setup

```bash
cd webapp
npm install
npm run dev       # http://localhost:5173
npm run build     # type-checks, then builds to webapp/dist
npm run preview   # serve the production build locally
```

## Static assets

Your `style.css`, `crypto-js.min.js`, `service-worker.js`,
`manifest.json`, and both icons are already in `webapp/public/` —
Vite copies that folder's contents to the output root untouched, so
they're referenced in `index.html` as root-relative paths
(`/style.css`, `/crypto-js.min.js`, etc.), both in dev and in the
built `dist/`.

`crypto-js.min.js` is still loaded as a plain `<script>` tag (a global
`CryptoJS`, exactly like before) rather than npm-installed — it's
declared as an ambient type in
`webapp/adapters/types/crypto-js.d.ts` so `CryptoJSAdapter.ts` can use
it under `strict` TypeScript.

`service-worker.js` was updated: it no longer tries to precache
`script.js` by name, since Vite's built JS bundle has a hashed
filename decided at build time. Instead it precaches the stable-named
shell files (`index.html`, `style.css`, icons, `manifest.json`,
`crypto-js.min.js`), and the existing cache-on-first-fetch logic in
the `fetch` handler picks up the hashed `/assets/*.js` bundle
automatically the first time it's requested.

## UI

Not restructured, as requested — `webapp/src/main.ts` is a
straight port of the original `script.js`'s DOM logic, typed, with
every direct `localStorage`/`CryptoJS`/`fetch` call replaced by a call
into `VaultService` / `BufferService` / `AiService`.
