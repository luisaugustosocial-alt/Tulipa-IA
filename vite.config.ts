import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "brand/tulipa-symbol.png",
        "brand/tulipa-logo.png",
      ],

      manifest: {
        name: "Tulipa IA",
        short_name: "Tulipa",
        description:
          "Assistente virtual para estudar, escrever, organizar ideias e muito mais.",

        theme_color: "#5b1f67",
        background_color: "#5b1f67",

        display: "standalone",
        orientation: "portrait-primary",

        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/brand/tulipa-symbol.png",
            sizes: "any",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
