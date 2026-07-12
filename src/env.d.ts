/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_APP_ENV?: "local" | "test" | "demo" | "production";
  readonly PUBLIC_APP_NAME?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_API_BASE_PATH?: string;
  readonly PUBLIC_DEMO_DATA_NOTICE?: string;
  readonly EMERCARD_API_PROXY_TARGET?: string;
  readonly EMERCARD_OPENAPI_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
