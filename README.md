# EmerCard frontend

Static Astro frontend for the EmerCard application domain. Browser auth/session traffic stays on the same origin through `/api/*`.

## Foundation baseline

Verified on 2026-07-12:

| Tool                  |       Version | Notes                                       |
| --------------------- | ------------: | ------------------------------------------- |
| Node.js               |        24 LTS | Use for local development and CI            |
| npm                   | 12.x baseline | Use the committed lockfile with `npm ci`    |
| Astro                 |         7.0.7 | Static-first site framework                 |
| `@astrojs/react`      |         6.0.1 | React page roots and hydration              |
| React / React DOM     |        19.2.7 | Interactive page islands                    |
| TypeScript            |         6.0.3 | Strict type-checking                        |
| Tailwind CSS          |         4.3.2 | CSS-first styling                           |
| Zod                   |         4.4.3 | Runtime validation for untrusted boundaries |
| TanStack Query        |       5.101.2 | Memory-only server-state cache              |
| React Hook Form       |        7.81.0 | Feature form state                          |
| `@hey-api/openapi-ts` |        0.99.0 | Generated OpenAPI contracts                 |
| Vitest                |        4.1.10 | Unit/component tests                        |
| Playwright            |        1.61.1 | Browser smoke tests                         |
| Prettier              |         3.9.5 | Formatting                                  |

## Route map

| Route        | Access             | Purpose                   |
| ------------ | ------------------ | ------------------------- |
| `/`          | public             | Marketing landing page    |
| `/login`     | public             | Authentication shell      |
| `/register`  | public             | Registration shell        |
| `/app/*`     | authenticated user | User application shells   |
| `/admin/*`   | administrator      | Admin application shells  |
| `/e/{token}` | public             | Emergency profile page    |
| `/api/*`     | API                | Same-origin reverse proxy to FastAPI |

## Authentication/session transport

- Browser auth/session requests go to `/api/v1/*` through Astro's same-origin proxy.
- The frontend uses `credentials: "same-origin"` and `cache: "no-store"` for auth/session calls; it never stores or reads session tokens in browser storage.
- Local development and Playwright smoke tests use `EMERCARD_API_PROXY_TARGET` as the backend proxy target.
- In production, the host must keep the app and `/api/*` on the same origin, with the browser receiving the session cookie as `HttpOnly`, `Secure`, host-only, and `SameSite=Lax` over HTTPS.
- Logout clears the current browser session only; a copied stateless JWT cannot be globally revoked in Phase 1.

## Emergency page rules

The emergency page remains a static Astro page. The hosting platform must apply this fallback before any authentication routing:

```text
/e/* -> /e/index.html (200)
```

`public/_redirects` contains this rule for static hosts that support the `_redirects` format. Configure an equivalent rewrite if the selected platform uses another format.

The static page reads the path token only in memory and calls the same-origin API:

```http
GET /api/v1/public/{token}
```

The legacy `GET /api/v1/emergency/{token}` route remains available for backend compatibility, but the browser demo uses `/api/v1/public/{token}`. Requests send `credentials: "omit"`, `cache: "no-store"`, and `referrerPolicy: "no-referrer"`. The page does not persist the token or returned medical profile in browser storage, service-worker caches, analytics, or error reporting.

`public/_headers` applies no-store/noindex/referrer protections to `/e/*` and the public API route for compatible static hosts.

## Demo workflow

Use fictional data only.

1. Log in as the demo user and complete the profile until it is ready.
2. Run the backend public-profile command to generate the URL.
3. Open the printed `/e/{token}` URL in a private browser window.
4. Update one visible profile field and save.
5. Refresh the same public URL and confirm the updated value appears.
6. Disable or regenerate the link and confirm the old URL stops working while the new URL succeeds.

## Environment

Copy `.env.example` when configuring local development.

- `PUBLIC_APP_ENV` — `local | test | demo | production`
- `PUBLIC_APP_NAME` — visible application name
- `PUBLIC_SITE_URL` — public site origin
- `PUBLIC_API_BASE_PATH` — defaults to `/api`
- `PUBLIC_DEMO_DATA_NOTICE` — optional demo banner copy
- `EMERCARD_API_PROXY_TARGET` — local backend target for Astro/Vite proxying and Playwright browser auth tests
- `EMERCARD_OPENAPI_URL` — backend OpenAPI snapshot URL for `api:sync`

## Scripts

- `npm run build` — static production build
- `npm run check` — ESLint + TypeScript no-emit verification
- `npm run typecheck` — TypeScript no-emit typecheck
- `npm run lint` — ESLint for project config and script files only
- `npm run format:check` — Prettier verification for the hand-edited foundation files
- `npm run test` — Vitest
- `npm run test:e2e` — Playwright smoke tests against the same-origin `/api` proxy
- `npm run api:sync` — fetch the backend OpenAPI snapshot
- `npm run api:generate` — generate the typed client from the snapshot
- `npm run api:check` — verify generated output is current

## Local verification

```bash
npm ci
npm run check
npm run test
npm run test:e2e
npm run api:check
npm run build
```

The build must produce `dist/e/index.html`, `_redirects`, and `_headers`.

## Deployment note

GitHub Pages and other static-only hosts do not provide the required same-origin `/api/*` reverse proxy. Use them only for static preview unless a proxy-capable edge or host is configured separately.

For production, keep the frontend origin, `/api/*`, and the session cookie aligned on HTTPS. If the deployment cannot preserve that same-origin surface, it must provide an equivalent proxy layer before the browser sees the app.

## Deferred work

The quick demo does not include user-controlled link management, scan history, token expiry, versioning, analytics, realtime updates, or deployment verification beyond the static/browser checks above.
