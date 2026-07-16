# Context Pack

## Spec source
- Active spec: user request to redesign all existing EmerCard frontend screens
- Current task: implement a new visual identity close to the existing landing page while preserving routes and behavior

## Current goal
- Unify marketing, auth, authenticated user, admin, blog, emergency, and fallback screens under a cool-white, emerald-led EmerCard identity.
- Preserve existing routes, labels where behavior depends on them, API contracts, and form fields.

## Affected repos / packages
| Path | Role | Why it matters |
|---|---|---|
| `src/styles/` | design tokens and global CSS | shared visual foundation |
| `src/components/primitives/` | buttons, panels, form controls, badges | shared product visual language |
| `src/components/layout/` | app shell, brand, nav, page title | authenticated screen chrome |
| `src/layouts/` | Astro page shells | auth, app, emergency and marketing framing |
| `src/components/common/` | marketing/blog nav and footer | public content surfaces |
| `src/components/blog/` | blog cards, breadcrumbs, pagination | content templates |
| `src/components/emergency/` | public emergency profile | high-trust emergency surface |
| `src/features/` | React auth, user, profile, admin screens | core product behavior and UI |
| `src/pages/` | route entrypoints | screen inventory and route preservation |

## Bounded context / domain language
- Context files consulted: `README.md`, current route map, existing feature components, design-taste-frontend skill.
- Canonical terms: medical profile, emergency contact, public link, pending, active, disabled, revoked, expired, card inventory, encoding verification, issue, replace, report lost.
- Terms to avoid: changing API/domain semantics during visual work.

## Important interfaces / contracts
- Routes: `/`, `/login`, `/register`, `/app`, `/app/profile`, `/app/cards`, `/admin`, `/admin/cards`, `/admin/cards/detail?cardId=...`, `/admin/links`, `/e/{token}`, `/blog`, `/blog/{slug}`, `/404`.
- API contracts live under `src/api/`; do not change them for visual redesign.
- Form field names and order must remain stable.
- Session and role gates in `src/features/session/index.tsx` must remain behaviorally intact.

## Project conventions
- Astro page shells with React islands via `client:load`.
- Tailwind v4 utilities plus CSS variables in `src/styles/tokens.css`.
- Existing API and feature tests use Vitest.
- Verification: `npm run check`, `npm run test`, `npm run build`.
- Prefer small shared-component and token changes over repeated page-specific CSS.

## Do not touch
- API endpoints, generated OpenAPI output, auth/session transport, route slugs, form field names/order, public emergency token handling, or business rules.
- Do not add fake data or replace real image assets with fake screenshots.

## Known risks
- Shared primitive changes can affect many existing tests and screens.
- Public landing page currently uses explicit Tailwind colors rather than semantic tokens.
- Admin and emergency surfaces must stay highly readable and accessible even while adopting the new brand.
- Some legacy marketing files contain unused navigation/footer dependencies and mixed languages.

## Recommended implementation entry point
1. Update tokens, global CSS, primitives, and shared shells.
2. Redesign public navigation/footer, auth, blog, and emergency framing.
3. Refine authenticated user/admin shells and screen composition without changing mutations or queries.
4. Run `npm run check`, `npm run test`, and `npm run build`; inspect generated routes.
