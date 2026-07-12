// @ts-check
import react from "@astrojs/react";
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

const apiProxyTarget =
  process.env.EMERCARD_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

// https://astro.build/config
export default defineConfig({
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
  fonts: [
    {
      name: "Source Sans 3",
      cssVariable: "--font-source-sans-3",
      provider: fontProviders.google(),
      weights: [400, 500, 600, 700],
      styles: ["normal", "italic"],
      subsets: ["latin", "vietnamese"],
      fallbacks: ["sans-serif"],
    },
    {
      provider: fontProviders.google(),
      name: "Inconsolata",
      cssVariable: "--font-inconsolata",
      weights: [400, 700],
      styles: ["normal"],
      subsets: ["latin", "vietnamese"],
    },
  ],
  site: "https://app.emercard.id.vn",
  i18n: {
    defaultLocale: "vi",
    locales: ["vi", "en"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
