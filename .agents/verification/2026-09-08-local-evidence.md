# Local main automated evidence — 8 September 2026

This records automated local evidence only. It does not certify a deployed release, desktop runtime, physical iPhone, or production/operator behaviour. Human-verification boxes remain pending unless the user confirms them against the named environment.

## Release E2E

- `pnpm build:e2e` passed after the shared Canvas toggle fix.
- The first `pnpm test:e2e:release` run completed 241 Chromium journeys: 237 passed and 4 failed under the 16.5-minute concurrent run.
- The public catalogue failure was a local API `socket hang up`; its isolated journey passed.
- The three Sandbox failures were runtime/readiness failures during the concurrent run. The branch-protection journey, custom local-preparation journey and multi-file evidence journey each passed in isolation; the complete 10-test `sandbox-delivery.spec.ts` suite then passed.
- A second full release run completed 241 journeys: 224 passed and 17 failed. Its failures clustered around Sandbox container/service timing, Work journeys after the local runtime became busy, and `playwright-visual-cloud` request/finalisation failures. The file-as-task journey passed in isolation; the complete 10-test `sandbox-environment.spec.ts` suite passed in isolation; and the affected membership/service journey passed in isolation after the selector retry.
- Visual capture reported 112 matched, 149 changed and 104 new captures; those changes still require visual review.

## Focused evidence

- `features/model-sources.spec.ts`: 1 passed, including first-account display and remembered dismissal.
- `features/model-selection.spec.ts`: 3 passed, including conversation-authoritative model retention, delayed catalogue loading and unavailable-model retention.
- `features/models-page.spec.ts`: 3 passed, including section navigation, provider artwork/fallback marks and tier headlines.
- Canvas, temporary-storage and Canvas-generation journeys: 8 passed.
- `features/sandbox-layout.spec.ts`: 2 passed across desktop and mobile Workbench layouts.
- `features/sandbox-delivery.spec.ts`: 10 passed.
- `features/sandbox-evidence.spec.ts`: multi-file review and membership journey passed.
- `features/sandbox-environment.spec.ts`: 10 passed in isolation.
- The affected Sandbox membership/service journeys passed in isolation; expected container errors remained inside the negative-path assertions.
- `features/work.spec.ts -g 'sends a project conversation using its Work context'`: 1 passed.
- `features/file-as-task.spec.ts -g 'files what was typed, links back to the conversation, and still answers with the toggle off'`: 1 passed in isolation.
- Queue check-offs made from this evidence: the legacy Canvas entry point, Work project tier inheritance/override, and teammate @ mention items are now checked in their pending verification files. The replay item remains open because its passing journey is a single stored run, not a multi-step task. Unsupported operator, cross-device, deployment, mouse-selection and failure-injection items remain unchecked.
- The Work tier E2E was updated to exercise the checklist's High override explicitly and passed in isolation; the replay item remains open because the passing journey is a single stored run, not a multi-step task.
- The places E2E also supports the one-shell `/chat/teammates` and retired top-level `/teammates` item, which is now checked; Poly and legacy-route checks remain open.
- The public catalogue E2E now covers following an app link from an already-open conversation without sending; that pending item is checked.
- The models-page E2E now covers provider marks across all seven named palettes, including Standard Compute and The Grid AI; that pending item is checked. The Discover models band remains open.
- `pnpm typecheck`: passed.
- `pnpm check`: passed again after the final page-object change; existing warnings remain, with no lint or formatting errors.
- `git diff --check`: passed.

## Fixes found during validation

- Authenticated E2E personas now carry the model-sources onboarding acknowledgement by default, while a fresh persona still exercises the first-display path.
- Canvas mode uses a functional state transition and the E2E helper tolerates the hydration window before the generation surface mounts.
- Signed-in persona readiness waits for the authenticated settings identity, avoiding navigation races.
- Model selection waits for the selector panel to mount without toggling an opening panel closed.
- The temporary-storage journey now expects the API's deliberate unauthenticated `401` response.
- Model-selection and Workbench assertions now match the current conversation-authoritative model and `Delegates` tab behaviour.
- Provider artwork evidence accepts the explicit initial fallback for providers without registered artwork.
- Model-option selection reacquires a detached option when the catalogue rerenders during a test.

## Checkout and remaining verification

- Checkout remained on local `main` throughout. No branch, worktree, push or pull request was created.
- No deployment, migration, desktop packaged-runtime, physical-device, production integration, or operator check was performed.
- The pending queue remains the source of truth for those human and deployment checks.
