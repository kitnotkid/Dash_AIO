# Tag Configurator

Static browser app: HTML/CSS/TypeScript, no bundler, no server. Compiled JS is
loaded directly by the browser as ES modules.

## Develop

```
npm install
npm run watch   # tsc -w, recompiles src/*.ts to js/*.js on save
```

Open `index.html` with any static file server (or a "Live Server"-style
extension) — it imports `./js/main.js` directly.

## Build

```
npm run build
```

Compiles `src/**/*.ts` to `js/**/*.js`.

## Deploy (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `apps/tag-configurator` (this folder — `index.html`,
  `styles.css`, and the compiled `js/` sit side by side, no separate publish
  copy step needed)

## Parser status

`src/parseL5K.ts` and `src/parseCsv.ts` are a first pass based on the general
Rockwell L5K/CSV export shape described in `docs/PROJECT_GUIDE.md` §4. They
have **not** been validated against real RSLogix/Studio 5000 export files —
replace/extend them once real samples are available, since column layout is
known to vary by export tool.
