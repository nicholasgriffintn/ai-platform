# Proposed frontend package architecture

Status: proposed

This proposal audits the current React frontend and defines package seams for future web,
desktop, and mobile surfaces. It does not change the accepted Chat, Work, project experience,
assistant capability, or canonical resource decisions in the existing ADRs.

## Recommendation

Extract the frontend in dependency order, not by moving today's directories wholesale:

1. Publish contracts, configuration, and pure utilities.
2. Put host-specific behaviour behind one surface interface.
3. Extract the API, chat, realtime, and React controller modules.
4. Extract render modules from primitives upwards.
5. Leave route composition, document metadata, service-worker setup, CAPTCHA, and concrete
   platform adapters in each application.

Use the requested names for public packages:

- render modules: `@ngriffin_uk/polychat-component-*`;
- behavioural modules: `@ngriffin_uk/polychat-library-*`;
- stateless helpers: `@ngriffin_uk/polychat-utility-*`;
- shared contracts: `@ngriffin_uk/polychat-schemas`; and
- shared tooling: `@ngriffin_uk/polychat-config`.

Do not create a package for every current folder. A package must provide a stable interface,
hide meaningful implementation, and have a credible independent consumer or release reason.

## Surface constraint

The current render implementation uses React DOM, Tailwind, Radix, browser files, WebRTC, and
DOM events. The existing mobile client is native Swift. npm packaging does not make those render
modules reusable in Swift, and React DOM modules are not React Native modules.

There are therefore two valid reuse levels:

| Target surface                                 | Directly reusable                                                                              | Surface-owned implementation                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Browser, Electron, Tauri webview, or Capacitor | schemas, libraries, utilities, React DOM render modules                                        | navigation, secure storage, file/media permissions, window lifecycle |
| React Native                                   | schemas, most pure libraries, selected controllers                                             | all visual primitives and DOM-dependent render modules               |
| Native Swift                                   | wire contracts and product semantics only; generated native models may be derived from schemas | controllers, persistence, networking, and all rendering              |

For maximum near-term reuse, use a shared React DOM renderer inside desktop and mobile shells.
If native rendering is the product requirement, treat the component packages as web/desktop
packages and reuse only the contracts and behavioural modules on mobile.

## Audit scope

The audit covers all TypeScript and TSX source under `apps/app/src/components`, plus the hooks,
libraries, stores, and frontend types those render modules consume. Test files are counted
separately.

| Area                | Source modules | Tests | Source lines |
| ------------------- | -------------: | ----: | -----------: |
| Render modules      |            390 |   102 |       49,294 |
| Hooks               |             65 |    17 |        8,508 |
| Frontend libraries  |            143 |    78 |       14,745 |
| Stores and contexts |              6 |     1 |          476 |
| Frontend types      |             16 |     0 |        1,490 |

The render tree is not currently a reusable package graph:

- 50 non-test render modules import React Router directly.
- At least 40 render modules access browser globals directly.
- Conversation render modules directly consume hooks, Zustand stores, API calls, analytics,
  toasts, navigation, timers, and browser utilities.
- `ConversationThread` exposes a large mode configuration while still owning data access,
  mutations, navigation, analytics, artefact state, speech playback, and connector approval.
- `Apps` and `ConversationThread` import each other, so moving either folder as-is would create a
  package cycle.
- Tailwind tokens and global CSS live in the web application, so copied render modules do not
  have a self-contained style interface.
- Several of the most load-bearing modules are very large: the model selector is 965 lines,
  `useRealtimeLiveSession` is 922 lines, the user settings form is 907 lines, chat input is 752
  lines, and the conversation thread is 634 lines.

### Complete render-area disposition

This table accounts for every current top-level render area. The split column identifies
restructuring required before extraction.

| Current area         | Source modules | Proposed owner                         | Required split                                                                                                                                                                                                     |
| -------------------- | -------------: | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Apps`               |             60 | capabilities, content, and experiences | Move recipes, catalogue cards, and dynamic forms to capabilities; response and artefact rendering to content; Notes, Articles, Podcasts, and Strudel to experiences. Remove its imports of conversation internals. |
| `Canvas`             |             17 | experiences                            | Keep media generation and drawing behind the media subpath. Move API/query ownership to controllers.                                                                                                               |
| `ChatSidebar`        |              2 | navigation                             | Accept conversation summaries and navigation intents rather than hooks and store access.                                                                                                                           |
| `ConversationThread` |             67 | conversation, content, and models      | Move model selection to models and response/artefact rendering to content. Replace store, API, router, toast, analytics, and browser access with controllers.                                                      |
| `Core`               |             17 | UI, navigation, or application host    | Move reusable page states and shells to UI; mode controls to navigation. Keep HTML document shell, analytics bootstrap, initialisation, and service-worker registration in the host.                               |
| `Council`            |              1 | conversation                           | Keep council controls beside the chat mode controller.                                                                                                                                                             |
| `HCaptcha`           |              2 | application host                       | Keep as a web authentication adapter; expose only verification capability to shared controllers.                                                                                                                   |
| `Home`               |              5 | application host and conversation      | Keep route composition in the host. Move reusable live/council mode controls to conversation after they stop reading host stores and routes.                                                                       |
| `LoadingSpinner`     |              1 | UI                                     | Merge into the shared status primitives.                                                                                                                                                                           |
| `ModelCard`          |              1 | models                                 | Extract with the catalogue presentation interface.                                                                                                                                                                 |
| `ModelIcon`          |             72 | models                                 | Export the icon registry through one stable interface; keep individual icon files private.                                                                                                                         |
| `Models`             |              3 | models or account                      | Keep model presentation in models; move sign-in and GitHub connection flows to account or the host.                                                                                                                |
| `Navbar`             |              1 | navigation                             | Fold into the navigation shell rather than publish a one-file package.                                                                                                                                             |
| `Profile`            |             30 | account                                | Separate controlled account/settings views from auth, billing, connector, passkey, and provider controllers.                                                                                                       |
| `Realtime`           |              0 | realtime library                       | There is no render implementation to extract; current behaviour belongs in the realtime library and conversation controls.                                                                                         |
| `Replicate`          |              5 | experiences                            | Place under the media subpath with injected prediction controllers.                                                                                                                                                |
| `Search`             |              1 | navigation                             | Accept results, loading state, and selection callbacks; do not navigate or fetch internally.                                                                                                                       |
| `Sidebar`            |              8 | navigation                             | Replace direct route and store reads with navigation state and intents.                                                                                                                                            |
| `Strudel`            |              2 | experiences                            | Place under the music subpath. Keep WebAudio and editor adapters explicit.                                                                                                                                         |
| `Training`           |              9 | experiences                            | Place under the training subpath. Keep provider-account ownership from ADR 0007.                                                                                                                                   |
| `ui`                 |             42 | UI and content                         | Keep controls, forms, dialogs, status, and layout in UI. Move Markdown, Prose, image preview, and share/content rendering to content where appropriate.                                                            |
| `Uploader`           |              2 | UI plus surface controller             | Keep the visual drop/input interface in UI; host file selection, upload, and permissions outside it.                                                                                                               |
| `Work`               |             42 | workspaces and application host        | Move controlled workspace/project views to workspaces. Keep route loaders, path construction, experience mounting, and `WorkDataProvider` composition in the host.                                                 |

## Deepening opportunities

### 1. Surface control seam

**Files:** router-coupled render modules, browser-global call sites, `external-navigation.ts`,
clipboard/file/audio hooks, HCaptcha, analytics, and host stores.

**Problem:** shared rendering currently knows how the web host navigates, stores data, opens URLs,
copies text, shares content, selects files, captures audio, and reports events. Moving files would
move this knowledge rather than hide it.

**Solution:** define one surface interface consumed through the React provider. It should express
navigation intents, external links, clipboard, native share, file selection, secure key/value
storage, media capture, analytics, notifications, and a capability snapshot with unavailable
reasons. Web, desktop, and mobile applications supply adapters. Security-sensitive actions stay
host-owned.

**Benefits:** platform variance has locality, render modules gain leverage across surfaces, and
tests can exercise the same interface with a deterministic adapter.

**Trade-off:** adding a host action requires changing a deliberate interface instead of calling a
global directly. Do not generalise a capability until a second real host needs it; start with the
operations already used by the frontend.

### 2. Controlled conversation module

**Files:** `ConversationThread`, `ChatInput`, `ModelSelector`, chat messages, artefacts,
`useChatManager`, streaming hooks, stores, and conversation API clients.

**Problem:** the conversation interface is shallow. Callers learn a large mode configuration,
while the implementation still reaches through other seams for data, mutations, navigation,
analytics, and browser behaviour. The model selector and input modules also contain several
behaviours and render concerns in one file.

**Solution:** make the conversation package consume a small conversation controller and explicit
mode policy. The controller owns messages, selection, streaming, branching, approval, compaction,
speech, and submission. Render modules own only ephemeral presentation state. Split composer,
message timeline, model picker, and artefact workspace into private modules behind the package
interface.

**Benefits:** the package interface becomes the test surface. Chat and Work can keep their
accepted authority differences without duplicating rendering, and platform behaviour can change
through the surface adapter.

**Trade-off:** controller construction becomes an explicit host responsibility, and the current
large hook/store graph must be migrated before the render package is portable.

### 3. API client and React data controllers

**Files:** `src/lib/api`, 65 hooks, React Query setup, Zustand stores, and frontend-only transport
types.

**Problem:** the HTTP seam assumes cookie credentials, document cookies, a global API URL, and a
global fetch implementation. Hooks and render modules are coupled to a web singleton. Several
frontend types duplicate shared wire contracts.

**Solution:** expose a constructed Polychat client with injected base URL, fetch implementation,
auth headers or cookie policy, CSRF provider, timeout policy, and response validation. Build React
Query controllers on that client. Move wire shapes to schemas and keep view-only state in the
owning render or React library.

**Benefits:** cookie web auth and bearer-token native auth become adapters at a real seam. Tests
can use one fake transport, and error/validation behaviour gains locality.

**Trade-off:** callers must obtain the client from a provider or constructor. The initial type
cleanup is broad because `@ngriffin_uk/polychat-schemas` is referenced throughout every workspace.

### 4. Design and content systems

**Files:** `components/ui`, Core presentation modules, styles, ModelIcon, Markdown, response
renderers, and artefact renderers.

**Problem:** primitives rely on application-owned Tailwind configuration and global styles.
Higher-level rendering imports primitives through app aliases, while Markdown, media, response,
and artefact rendering are spread across `ui`, `Apps`, and `ConversationThread`.

**Solution:** publish UI tokens and primitives first, then a content package for Markdown,
citations, generated responses, media previews, and artefacts. Each render package emits an
explicit CSS entry in a named cascade layer; consumers import only the packages they mount. Do
not require consumers to scan package source in `node_modules` for Tailwind classes.

**Benefits:** visual changes have locality, content rendering is reusable by conversations,
outputs, sharing, and experiences, and the Apps/conversation cycle disappears.

**Trade-off:** compiled CSS may initially duplicate some utilities across package outputs. That is
preferable to an undocumented consumer build requirement and can be measured after extraction.

### 5. Capability and experience registries

**Files:** Apps, Canvas, Replicate, Strudel, Training, Work experiences, assistant action helpers,
and project capability catalogue modules.

**Problem:** catalogue presentation, installation/configuration, execution, and route mounting are
interleaved. Heavy optional runtimes such as Strudel, Babel artefact execution, and WebLLM can
inflate consumers that do not use them.

**Solution:** keep catalogue and recipe views in the capability package, keep runtime mounting in
the host, and publish experiences from explicit `content`, `media`, `music`, and `training`
subpaths. Do not provide a root barrel that imports every experience. Preserve the backend-owned
descriptors and launch contracts from ADRs 0003-0008.

**Benefits:** hosts install or load only supported experiences, and backend catalogue authority
continues to control availability. Runtime-specific dependencies stay local.

**Trade-off:** experience consumers use explicit subpath imports, and host registries must map
backend capability IDs to installed render adapters.

### 6. Shared configuration and release discipline

**Files:** TypeScript configurations, Oxlint, Oxfmt, Vitest, Tailwind, package manifests, and
workspace scripts.

**Problem:** compiler and test settings are repeated and already diverge. The repo uses Oxlint,
not ESLint, and has no package release metadata or Changesets workflow. `agent-core` is private and
exports source, while schemas uses a build output.

**Solution:** publish one config package with explicit presets, standardise package manifests and
build output, and adopt Changesets for independent versions. Add an ESLint preset only if a real
consumer adopts ESLint; do not add a second linter solely for naming symmetry.

**Benefits:** package rules gain locality, new surfaces inherit the same strict defaults, and
version intent is reviewed alongside code.

**Trade-off:** applications and Workers still need small local configurations for environment
types and build tools; the config package should not try to erase those differences.

## Proposed package set

### Contracts, configuration, and utilities

| Package                               | Interface and ownership                                                                                                                            | Initial sources                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `@ngriffin_uk/polychat-config`        | TypeScript base, React library, React application, Worker, and Node presets; Oxlint, Oxfmt, Vitest, and Tailwind presets through explicit subpaths | current tsconfig, lint, format, test, and Tailwind configuration                                     |
| `@ngriffin_uk/polychat-schemas`       | Zod schemas, inferred wire types, SSE contract, shared product constants, and validated catalogue contracts                                        | rename `packages/schemas`; absorb duplicated frontend wire types only when they are shared contracts |
| `@ngriffin_uk/polychat-utility-core`  | dependency-light pure helpers for strings, dates, numbers, object guards, IDs, formatting, and error inspection                                    | reusable pure modules from `src/lib`; exclude chat, navigation, storage, and browser helpers         |
| `@ngriffin_uk/polychat-utility-react` | generic React hooks with no Polychat domain knowledge                                                                                              | debounce, stable IDs, intersection/loading helpers, keyboard subscription primitives                 |

Do not publish a generic `utility-web` initially. Keep DOM, script loading, textarea measurement,
and other single-adapter helpers in the web host until desktop supplies a second real consumer.

### Behavioural libraries

| Package                                    | Interface and ownership                                                                                                                                           | Initial sources                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `@ngriffin_uk/polychat-library-agent-core` | reusable agent decision loop, approvals, and action handler contracts                                                                                             | rename and make `packages/library-agent-core` publishable                                  |
| `@ngriffin_uk/polychat-library-client`     | constructed, runtime-neutral Polychat HTTP client and domain clients; injected transport/auth policy                                                              | `src/lib/api`, after removing browser globals and the singleton                            |
| `@ngriffin_uk/polychat-library-chat`       | message preparation, stream assembly, request policy, branching, compaction, council turns, conversation cache rules, and local conversation repository interface | chat/conversation libraries and pure parts of the chat hooks                               |
| `@ngriffin_uk/polychat-library-realtime`   | realtime protocol, session state machine, audio gate/levels, and WebRTC/WebSocket adapters through explicit subpaths                                              | `src/lib/realtime` and pure parts of realtime hooks                                        |
| `@ngriffin_uk/polychat-library-surface`    | host control contracts and capability descriptions; no concrete privileged implementation                                                                         | navigation, storage, file, share, clipboard, analytics, notification, and media interfaces |
| `@ngriffin_uk/polychat-library-react`      | `PolychatProvider`, Query client construction, domain query/mutation hooks, controller factories, and shared UI/session state                                     | current hooks, contexts, and stores after generic hooks and pure behaviour move out        |

Keep the distinction strict: utilities are stateless helpers; libraries own domain behaviour or
state; render packages own presentation. Avoid a `common`, `shared`, or catch-all package.

### Render packages

| Package                                        | Stable interface                                                                                                                    | Current source disposition                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@ngriffin_uk/polychat-component-ui`           | theme tokens, controls, forms, dialogs, status, layout, upload presentation, and one CSS entry                                      | `ui`, reusable Core presentation, LoadingSpinner, Uploader presentation                       |
| `@ngriffin_uk/polychat-component-content`      | Markdown/prose, citations, generated response views, media previews, sharing views, and artefact rendering                          | UI content modules, Apps ResponseRenderer, ConversationThread artefacts and content rendering |
| `@ngriffin_uk/polychat-component-models`       | model/provider icon registry, cards, picker views, settings views, and controlled model selection                                   | ModelIcon, ModelCard, model presentation, model selector render modules                       |
| `@ngriffin_uk/polychat-component-conversation` | controlled conversation timeline, composer, message actions, council controls, welcome state, and conversation controller interface | ConversationThread after model/content extraction, Council, reusable Home mode controls       |
| `@ngriffin_uk/polychat-component-navigation`   | product-mode controls, sidebars, search, page navigation shell, and navigation-intent rendering                                     | Sidebar, ChatSidebar, Navbar, Search, reusable Core navigation modules                        |
| `@ngriffin_uk/polychat-component-capabilities` | capability catalogue/cards, filters, recipe configuration/scheduling, dynamic forms, and controlled launch actions                  | generic Apps modules and reusable project capability presentation                             |
| `@ngriffin_uk/polychat-component-workspaces`   | controlled workspace, project, source, output, activity, governance, membership, and project library views                          | Work, excluding routes, path construction, provider composition, and experience mounts        |
| `@ngriffin_uk/polychat-component-account`      | controlled profile, auth prompts, settings, billing, providers, connectors, agents, passkeys, sources, and task views               | Profile and account-specific Models modules                                                   |
| `@ngriffin_uk/polychat-component-experiences`  | explicit `/content`, `/media`, `/music`, and `/training` subpaths with no eager root export                                         | Articles, Notes, Podcasts; Canvas, Drawing, Replicate; Strudel; Training                      |

Start with one experiences package because the workflows share output, source, UI, and capability
interfaces. Split a subpath into its own package only when it needs an independent release cadence
or when optional dependencies cannot remain isolated.

## Dependency direction

The allowed package graph is one-way:

```text
config

schemas        utility-core        utility-react
   \                 |                  /
    +---------- libraries -------------+
                    |
             component-ui
                    |
       content / models / navigation
                    |
       conversation / capabilities
                    |
       workspaces / account / experiences
                    |
             surface applications
```

Enforce these rules:

- `schemas` and `utility-core` must not import React, browser globals, or application code.
- `library-client` must not import React or concrete auth storage.
- render packages must not import React Router, application aliases, API singletons, Zustand
  stores, `window`, `document`, or `navigator`.
- lower render packages must not import higher feature packages.
- applications may compose any package and own concrete adapters.
- public package imports must use export maps; forbid imports into another package's `src` tree.
- no package may depend on `apps/app`.

## Control rules for reusable rendering

Apply these rules to every exported render module:

- Accept data, status, permissions, capability state, and actions. Do not accept an identifier and
  fetch internally.
- Emit typed product intents such as open conversation, open project, launch capability, share
  output, or open external authorisation. Do not construct React Router paths.
- Keep domain state in controllers, controlled input state in `value`/`onChange` pairs, and only
  short-lived visual state inside the render implementation.
- Model unavailable operations explicitly. A hidden control and a disabled control with a reason
  are different product states.
- Keep authoritative project permissions and capability availability in backend contracts. The
  frontend may present them but must not infer authority from route shape or local ownership.
- Inject render registries for experiences, dynamic responses, artefacts, and model icons. Unknown
  entries must have a safe fallback.
- Keep privileged operations such as connector authorisation, passkeys, CAPTCHA, external URLs,
  file access, media capture, and artefact execution behind host controls.
- Never pass tokens, credentials, raw cookie readers, or upstream provider session IDs through a
  render interface.

## Styling and package build rules

- Use React and React DOM as peer dependencies for DOM render packages.
- Keep Radix and other implementation dependencies private unless callers must import their
  types or coordinate their state.
- Export ESM and declarations from `dist`; do not export TypeScript source as a public package
  interface.
- Set `sideEffects: false` for pure packages. Render packages that export CSS must list their CSS
  files in `sideEffects`.
- Export one explicit CSS entry per render package in a named cascade layer. The UI package owns
  tokens and base theme variables.
- Keep heavy runtimes behind explicit experience or library subpaths and lazy host registries.
- Test public exports from built output so missing exports, CSS, and declaration errors fail before
  publishing.

## Package renames

### Schemas

Rename `@ngriffin_uk/polychat-schemas` to `@ngriffin_uk/polychat-schemas` atomically. The old name is
referenced in 531 files across the frontend, API, Workers, packages, and documentation, so a
frontend-only alias would leave the shared contract seam with two identities. Preserve the
current build output and explicit subpath exports, then tighten the export map as frontend types
move into the package.

This is a new npm package identity. Start it at `0.1.0` unless preserving the current unpublished
`0.0.1` history is important. Do not publish a permanent compatibility wrapper for the internal
`@assistant` name.

### Agent core

Rename `@ngriffin_uk/polychat-library-agent-core` to `@ngriffin_uk/polychat-library-agent-core`. Before publishing,
remove `private: true`, build JavaScript and declarations into `dist`, add `files`, `license`,
`publishConfig`, and export-map metadata, and test the built interface. The current package exports
source files and is not publishable as configured.

## Changesets and publishing

The auth workspace provides a useful baseline:

- `@changesets/cli` is installed at the root;
- `.changeset/config.json` uses public access, independent versions, `main` as the base branch, and
  patch updates for internal dependencies;
- package dependencies use workspace ranges;
- public packages declare `publishConfig.access: public`; and
- the documented release is manual: check, audit, create a changeset, version, then run the root
  build-and-publish script.

The auth workspace does **not** currently contain an automated release workflow. Match that manual
flow first rather than describing it as deployment automation. Add a Changesets release-pull-
request workflow later only if npm trusted publishing or a narrowly scoped npm token is configured.

Recommended Polychat configuration:

- use independent package versions; do not put all render packages in a fixed version group;
- use `workspace:^` for published runtime dependencies and let Changesets update dependants;
- require one changeset for every public interface or behaviour change, but not for private app
  composition or documentation-only changes;
- build schemas and lower layers before dependants;
- run typecheck, lint, format check, tests, package builds, and `pnpm pack --dry-run` before publish;
- publish only non-private packages with public access;
- use npm provenance/trusted publishing when automation is introduced; and
- retain the repository's existing `pnpm audit --audit-level high` release check.

## Migration plan

### Phase 0: confirm the surface model

Choose whether mobile will host the React DOM renderer, use React Native, or remain Swift. This
does not block contracts and libraries, but it determines whether component reuse means exact
render reuse or behavioural reuse.

### Phase 1: establish package foundations

- Add `@ngriffin_uk/polychat-config` and Changesets.
- Rename and harden schemas and agent core.
- Add package manifest, export-map, build-output, and dependency-direction checks.
- Extract `utility-core` and `utility-react` only from helpers with multiple credible consumers.

Gate: every existing workspace builds and tests against the renamed packages; packed artefacts
contain only intended files.

### Phase 2: create the runtime seam

- Introduce the constructed client and auth/transport policy.
- Introduce surface controls using current web behaviour as the first adapter.
- Move pure chat and realtime behaviour behind their interfaces.
- Build React providers, query controllers, and controller factories on those libraries.

Gate: the web application uses injected clients and controls; shared render modules no longer need
browser globals or API singletons.

### Phase 3: extract the visual foundation

- Extract UI, content, and models in that order.
- Establish CSS entries, tokens, accessibility tests, public export tests, and package previews.
- Break the Apps/conversation cycle by moving response and artefact rendering to content.

Gate: the web application consumes only public exports and has no visual regression in the
extracted areas.

### Phase 4: extract one vertical conversation slice

- Build the controlled conversation controller interface.
- Move the timeline and composer in small slices, starting with message rendering and submission.
- Preserve the contextual Chat/Work policy from ADR 0008.

Gate: remote and local chat, streaming, errors, approvals, compaction, branching, attachments, and
Work project metadata pass integration tests through the public interface.

### Phase 5: extract product modules

- Extract navigation, capabilities, workspaces, and account.
- Keep route modules and application providers thin.
- Move experiences last through explicit host registries and subpath imports.

Gate: a minimal second React host can render UI, model selection, and a conversation without
importing `apps/app`.

### Phase 6: publish and consume

- Add changesets for the first public versions.
- Validate packed artefacts in a temporary consumer workspace.
- Publish in dependency order through the root release command.
- Add desktop/mobile adapters without adding platform branches inside render packages.

## Decisions still required

- Whether the future mobile interface is web-rendered, React Native, or native Swift.
- Whether all packages are intended for public npm consumption or only selected foundations.
- Whether release publishing remains manual like the auth workspace or moves to trusted-publishing
  automation after the first packages stabilise.

The recommended first implementation slice is Phase 1 plus `component-ui`: it validates naming,
build output, CSS distribution, configuration reuse, Changesets, and consumer ergonomics before
the conversation graph is disturbed.
