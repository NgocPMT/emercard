# EmerCard frontend

Static Astro frontend for the EmerCard application domain.

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
| `/api/*`     | API                | Same-origin reverse proxy |

## Emergency page rules

The emergency page remains a static Astro page. The hosting platform must apply this fallback before any authentication routing:

```text
/e/* -> /e/index.html (200)
```

`public/_redirects` contains this rule for static hosts that support the `_redirects` format. Configure an equivalent rewrite if the selected platform uses another format.

The static page reads the path token only in memory and calls the same-origin API:

```http
GET /api/v1/emergency/{token}
```

It sends `credentials: "omit"`, `cache: "no-store"`, and `referrerPolicy: "no-referrer"`. It does not persist the token or returned medical profile in browser storage, service-worker caches, analytics, or error reporting.

`public/_headers` applies no-store/noindex/referrer protections to `/e/*` and the public API route for compatible static hosts.

## Environment

Copy `.env.example` when configuring local development.

- `PUBLIC_APP_ENV` — `local | test | demo | production`
- `PUBLIC_APP_NAME` — visible application name
- `PUBLIC_SITE_URL` — public site origin
- `PUBLIC_API_BASE_PATH` — defaults to `/api`
- `PUBLIC_DEMO_DATA_NOTICE` — optional demo banner copy
- `EMERCARD_API_PROXY_TARGET` — local backend target for Astro/Vite proxying
- `EMERCARD_OPENAPI_URL` — backend OpenAPI snapshot URL for `api:sync`

## Scripts

- `npm run build` — static production build
- `npm run check` — ESLint + TypeScript no-emit verification
- `npm run typecheck` — TypeScript no-emit typecheck
- `npm run lint` — ESLint for project config and script files only
- `npm run format:check` — Prettier verification for the hand-edited foundation files
- `npm run test` — Vitest
- `npm run test:e2e` — Playwright smoke tests
- `npm run api:sync` — fetch the backend OpenAPI snapshot
- `npm run api:generate` — generate the typed client from the snapshot
- `npm run api:check` — verify generated output is current

## Local verification

```bash
npm ci
npm run check
npm run test
npm run api:check
npm run build
```

The build must produce `dist/e/index.html`, `_redirects`, and `_headers`.

## Deployment note

GitHub Pages and other static-only hosts do not provide the required same-origin `/api/*` reverse proxy. Use them only for static preview unless a proxy-capable edge or host is configured separately.
