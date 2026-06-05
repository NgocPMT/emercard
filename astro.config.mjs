// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  experimental: {
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
  },
  site: "https://emercard.id.vn",
  i18n: {
    defaultLocale: "vi",
    locales: ["vi", "en"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
