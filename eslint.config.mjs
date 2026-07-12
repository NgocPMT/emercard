import js from "@eslint/js";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".astro/**",
      "coverage/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  {
    files: [
      "astro.config.mjs",
      "eslint.config.mjs",
      "openapi-ts.config.mjs",
      "prettier.config.mjs",
      "scripts/*.mjs",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        AbortController: "readonly",
        URL: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
      },
    },
  },
  prettier,
];
