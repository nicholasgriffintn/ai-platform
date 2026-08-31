# Web application

This is Polychat's responsive web application and PWA, built with React, Tailwind CSS, and React Router. The native iOS client is a separate application.

## Features

- UI built with React and TailwindCSS
- Responsive design that works on both desktop and mobile devices
- Integration with the API backend for AI assistant capabilities
- A Work-only Lean Proofs experience for repository-targeted proof runs, evidence review, retry,
  approval, and saved project outputs
- Local conversation storage with IndexedDB (falls back to LocalStorage)
- Settings configuration for models and preferences
- Use the API catalogue's `isExecutable` marker to repair a persisted remote selection that the account can no longer run, then use `isDefault` for the automatic model. Do not add client fallback model IDs; submit automatic routing when no explicit executable model is selected.
- Leave max output tokens empty to use the API's workload-aware default. The settings control explains those defaults, accepts larger explicit overrides, and uses the model catalogue limit instead of a fixed client ceiling.
- One plus menu aligned to the composer's width and edges for imports and capability submenus, with the same composer-aligned presentation filtered by `/` for actions or `@` for capabilities. Slash input prefix-matches root command strings. Commands with choices, such as model, reasoning, verbosity, and tools, open an in-place submenu on Enter or selection; text after the command filters that submenu until the directive is selected or removed. Keyboard navigation keeps the highlighted row visible, while pointer movement changes the highlighted row without a stationary pointer interrupting typing. Dictate and Live remain dedicated controls, and composer controls expose shortcut tooltips after an intentional hover delay only.
- Composer menus and selectors render above banners, ask-user prompts, and conversation content. Tooltips sit above those interactive overlays, while the mobile sidebar drawer remains above the composer itself.
- Default model tools appear once in the plus menu as switch controls. They remain discoverable through `@`, but their catalogue rows are suppressed when those canonical controls are present.
- Surface a failed turn once at the conversation action boundary. Streaming hooks return or throw the failure without also showing a notification, so one provider error cannot produce duplicate messages.
- Use side submenus only on desktop layouts where hover and screen space support them; on mobile, tablet, coarse-pointer, or no-hover layouts, replace the menu contents with a tap-driven drilldown and an explicit Back action
- Web LLM support for offline usage
- Conversation goals show a compact start marker attached to the message that set the objective;
  later lifecycle events remain full-width timeline markers.
- Combine a previewable HTML, JavaScript, JSX, React, or SVG artefact with stylesheet artefacts from the same message. Stylesheets remain code-only on their own, while the combined panel injects them into the runnable preview. At tablet widths the panel overlays the conversation region; only extra-wide layouts reserve its full width beside the thread.
- Pets replace the old logo mark. A pet perches above the title on an empty conversation and at the right-hand end of the composer dock during one, and picks an animation from the live turn: thinking, running a tool, answering, finishing, or losing the stream. Both perches come from the shared conversation thread, so Chat and Work get them together. The pet is personal, read from `user_settings`, and never renders on a shared surface such as a share link or published output. Settings live under Profile > Pets.
- The built-in set is eight faceted presets: four polys, the house parrots carried over from the old logo variants, and four strays (a terminal, a cog, a flask, a mossy rock). Each has its own motion profile, so Ash barely stirs and Kea overreacts to everything. Preset sheets are committed PNGs in `apps/app/public/pets`, so new art is a designer export rather than a build step.
- A pet is one sprite sheet of eight 192x208 columns, one row per animation, transparent PNG or WebP. Two layouts are recognised, both declared in `packages/schemas/src/pets.ts`: `polychat-v1` at 1536x2288 with eleven rows, and `codex-v1` at 1536x1872 with nine, which is the Codex pet format. The sheet's dimensions are the whole contract, so an upload needs no accompanying metadata: the server matches them to a layout and stores its id on the pet. A clip a layout lacks falls back to idle, so a Codex sheet simply has no blink, preen or doze. Uploads and generation are Pro-only and validated server-side on the decoded image; SVG is deliberately not accepted because an uploaded SVG carries script.
- Do not render a pet until authentication, user settings, and any custom-pet library entry have resolved. The fallback preset is recovery behaviour, not a loading placeholder: showing it early flashes the wrong identity and animation preference.
- A person can assign pets to model makers, runtime providers, or model families. A maker rule is the broad one: assign Anthropic and every Claude model gets that pet whoever serves it. The narrowest rule wins, family before provider before maker, and the default selection handles automatic, unknown, and unmatched models. Rules are added from a searchable picker grouped by maker, provider, and family, so nobody has to scroll a flat list of every family in the catalogue. Target keys are normalised to lowercase and referenced pets are checked against the person's library when settings are validated. The conversation waits for the selected model's catalogue metadata before resolving the pet, then fades the old pet out and the new pet in only when the effective identity changes. Reduced-motion preferences make the swap immediate.
- The custom library has no authoring cap. Its API and settings UI use bounded server-backed pages, fetch an off-page selected pet directly, and defer each custom sprite sheet until its preview approaches the viewport. Presets remain immediately available.
- "Let your pet follow you" is off by default. Off, the pet appears only on the new chat screen, where the logo used to be. On, it also perches above the composer inside conversations and animates into place when the route changes.
- Pet animation is off by default. A person can enable expression and travel animations under Profile > Pets, while `prefers-reduced-motion: reduce` always leaves the pet on the first frame regardless of that setting.

## Lean Proofs

The `/capabilities` catalogue declares experience scope. Chat requests and renders personal experiences only; a Work project requests project experiences, and exposes Lean Proofs only after the project enables its app. Do not reproduce that scope policy in route components.

Lean Proofs lives below `/work/:workspaceId/projects/:projectId/experiences/lean-proofs`. Its creation form accepts an objective, one or more repository-relative `.lean` targets, optional qualified declarations, optional acceptance criteria, and a token budget. When no project coding repository is configured, direct the member back to project configuration instead of accepting a repository or installation in the form.

Creation starts the project task immediately. The project-scoped React Query hooks poll every two seconds while a run is queued or running, invalidate the task and output views after mutations, and stop polling at a terminal or review state. Detail views distinguish `kernel_checked`, `compiled`, `incomplete`, and `failed`, present compiler and kernel evidence separately from diagnostics, and offer retry only for retryable blocked states.

A successful result stops in review until a person approves it. The same structured `lean.proof` output renderer serves the experience detail and the saved project-output route, so a stored result cannot silently fall back to generic JSON presentation.

Native iOS does not launch or manage Lean Proofs in this decision. Mobile web continues to use the responsive Work experience; adding a native surface requires its own product and deployment decision.

Use the skill's [local setup](../setup.md), [configuration](../configuration.md), [deployment](../deployment.md), and [validation](../validation.md) workflows for current commands and environment guidance.
