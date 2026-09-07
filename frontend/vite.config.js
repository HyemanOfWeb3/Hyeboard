import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      includeAssets: ["hyeboard-icon.svg", "hyeboard-maskable.svg"],
      manifest: {
        name: "HyeBoard",
        short_name: "HyeBoard",
        description:
          "A fast, personal workspace for writing and organizing notes.",
        display: "standalone",
        start_url: "/",
        theme_color: "#0b0f0d",
        background_color: "#0b0f0d",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/hyeboard-icon.svg",
            sizes: "192x192 512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/hyeboard-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
