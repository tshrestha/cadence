import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative base so the build works when served from any sub-path.
  base: "./",
  build: {
    // Vite 8 minifies JS with Oxc and CSS by default — compact output, no
    // separate esbuild dependency required.
    cssMinify: true,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // Static files (served as-is) that should be precached for offline use.
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Cadence — Running Metronome",
        short_name: "Cadence",
        description: "A highly accurate, lightweight metronome for running cadence.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#08090a",
        theme_color: "#08090a",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Precache the built app shell (hashed filenames handled automatically).
        globPatterns: ["**/*.{js,css,html,svg}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Google Fonts stylesheets — refresh in the background.
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            // Google Fonts files — immutable, cache for a year.
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
