# Handoff

## Current status
ready for commit

## Spec or task source
- Path: `redesign-instructions.md`
- Type: redesign and live-flow verification

## What was done
- Refined shared healthcare visual tokens toward calm teal, neutral surfaces, restrained elevation, and Cabinet Grotesk fallbacks.
- Redesigned user readiness, profile editing, user cards, admin dashboard/cards/links/card-detail, and public emergency-profile surfaces without changing routes or frontend API contracts.
- Separated physical-card and public-link states, added guided provisioning steps, and replaced lifecycle native confirms with the shared accessible Dialog.
- Updated frontend E2E selectors and lifecycle setup for the current card-link API contract.
- Completed live QA with the supplied user/admin test accounts: authentication, role routing, user overview/profile/mobile save actions, admin dashboard/inventory/link selection, and responsive layouts.
- Fixed the sibling backend’s duplicate-registration fallback when the Mongo unique index is absent: `UserRepository.create` now checks the canonical email before insertion while retaining duplicate-key handling for concurrent writes.
- Restarted the local backend and verified the second same-email registration now returns `409 auth.email_already_registered`.

## Tasks completed
- Priority-1 core journey redesign.
- Accessible confirmations across user and admin card lifecycle actions.
- Full authenticated card lifecycle E2E coverage with supplied admin credentials.
- Duplicate registration regression test and backend guard.

## Files changed
### Frontend
- `src/styles/tokens.css`
- `src/styles/global.css`
- `src/components/emergency/EmergencyProfilePage.astro`
- `src/features/app/index.tsx`
- `src/features/profile/index.tsx`
- `src/features/admin/index.tsx`
- `src/features/admin/link-manager.tsx`
- `src/features/admin/link-manager.test.tsx`
- `src/features/admin/card-detail.tsx`
- `src/features/admin/card-detail.test.tsx`
- `tests/smoke.spec.ts`
- `tests/auth-lifecycle.spec.ts`
- `tests/card-link-lifecycle.spec.ts`

### Backend (`../emercard-backend`)
- `src/emercard/modules/users/repository.py`
- `tests/test_repositories.py`

## Verification
### Commands run
- Frontend: `npm run test`, `npm run build`, and `npm run test:e2e` with the supplied admin credentials.
- Backend: targeted `uv run pytest tests/test_repositories.py tests/test_auth.py -q`; `uv run ruff check ...`; `uv run pyright ...`.
- Live repro: two same-email registration `curl` requests after restarting the backend.

### Results
- Frontend Vitest: 17 files, 62 tests passed.
- Frontend Playwright: 16 tests passed.
- Frontend Astro build: 22 pages generated.
- Backend targeted tests: 19 passed.
- Backend ruff and pyright: passed.
- Live duplicate registration: first request `201`; second request `409 auth.email_already_registered`.

### Not run / not verified
- Full backend suite is not green because of unrelated pre-existing worktree changes outside this task: index fixture, profile location-alert model fixture, and seed-admin configuration tests fail. Do not attribute those failures to the duplicate-registration fix.

## Review status
- Status: not run; `.code-reviewer/context.md` is absent in the frontend repository.
- Must-fix findings: none for this task.

## Known issues and risks
- Mongo’s unique email index should still be initialized in deployed environments; the application-level precheck is a safety fallback, not a replacement for database-level concurrency protection.
- Both repositories contain unrelated pre-existing changes. Stage only the files listed above for this task.
- Astro/Vite continues to emit existing `esbuild` deprecation and daisyUI `@property` warnings during build.

## Recommended next step
- Review and commit the scoped frontend and backend changes separately. Ensure the deployment process runs the backend index-initialization command or enables startup index initialization.

## Suggested next prompt
`Review the scoped frontend and backend changes from .agent/handoff.md, then prepare separate commits for the redesign/E2E updates and the backend duplicate-registration safeguard.`
