# cadence

A highly accurate, lightweight metronome for running cadence. Installable PWA, works fully offline.

## Develop

```bash
npm install
npm run dev      # start the Vite dev server (HMR)
```

## Build

```bash
npm run build    # minified production build → dist/
npm run preview  # serve the production build locally
```

The build is bundled and minified by Vite. PWA support (service worker, web
app manifest, offline precaching, and Google Fonts runtime caching) is
generated automatically by `vite-plugin-pwa` — see `vite.config.js`.

## Structure

- `index.html` — app markup (entry point)
- `src/main.js` — metronome logic + audio engine
- `src/style.css` — styles
- `public/icon.svg` — app icon (copied to the build root as-is)
- `vite.config.js` — build + PWA configuration
