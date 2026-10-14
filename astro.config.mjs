// @ts-check
import react from "@astrojs/react";
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Keep browser auth/session traffic same-origin in local dev and tests.
// Astro proxies `/api/*` to Express TypeScript backend so the frontend sees one origin.
const apiProxyTarget =
  process.env.EMERCARD_API_PROXY_TARGET ?? "http://127.0.0.1:3000";

function emergencyPreviewRouteRewrite() {
  /**
   * @param {import("node:http").IncomingMessage & { url?: string }} request
   */
  const rewrite = (request) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (
      url.pathname.startsWith("/e/") &&
      url.pathname !== "/e/index.html" &&
      !url.pathname.includes(".")
    ) {
      request.url = "/e/index.html" + url.search;
    }
  };

  return {
    name: "emercard-emergency-preview-route-rewrite",
    /**
     * @param {import("vite").ViteDevServer} server
     */
    configureServer(server) {
      /**
       * @type {(request: import("node:http").IncomingMessage & { url?: string }, _response: import("node:http").ServerResponse, next: () => void) => void}
       */
      const middleware = (request, _response, next) => {
        rewrite(request);
        next();
      };
      server.middlewares.use(middleware);
    },
    /**
     * @param {import("vite").ViteDevServer} server
     */
    configurePreviewServer(server) {
      /**
       * @type {(request: import("node:http").IncomingMessage & { url?: string }, _response: import("node:http").ServerResponse, next: () => void) => void}
       */
      const middleware = (request, _response, next) => {
        rewrite(request);
        next();
      };
      server.middlewares.use(middleware);
    },
  };
}

// https://astro.build/config
export default defineConfig({
  output: "static",
  devToolbar: { enabled: false },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), emergencyPreviewRouteRewrite()],
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
