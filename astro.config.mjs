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
        provider: fontProviders.google(),
        name: "Nunito",
        cssVariable: "--font-nunito",
        weights: [400, 500, 600, 700],
        styles: ["normal"],
        subsets: ["latin", "latin-ext"],
      },
      {
        provider: fontProviders.google(),
        name: "Inconsolata",
        cssVariable: "--font-inconsolata",
        weights: [400, 700],
        styles: ["normal"],
        subsets: ["latin", "latin-ext"],
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
