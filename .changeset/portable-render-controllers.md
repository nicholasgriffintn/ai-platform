---
"@ngriffin_uk/polychat-component-account": minor
"@ngriffin_uk/polychat-component-capabilities": minor
"@ngriffin_uk/polychat-component-content": minor
"@ngriffin_uk/polychat-component-conversation": minor
"@ngriffin_uk/polychat-component-experiences": minor
"@ngriffin_uk/polychat-component-models": minor
"@ngriffin_uk/polychat-component-navigation": minor
"@ngriffin_uk/polychat-component-ui": minor
"@ngriffin_uk/polychat-component-workspaces": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-library-surface": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-utility-react": minor
---

Move the shipped render implementations into their packages and replace the placeholder interfaces.

Host seams added so render modules stay portable:

- `component-ui` exposes `LinkProvider`, `Link`, and `NavLink`; hosts pass resolved hrefs and supply
  their own router.
- `library-surface` defines `SurfaceAnalytics`, and `library-react` exposes `AnalyticsProvider` and
  `useAnalytics`, so render modules report events without knowing the provider.
- `component-content` exposes `CustomResponseViewProvider`, so tool responses that need host data
  are registered by the application and unknown names fall back to the raw JSON view.

Render ownership:

- `component-ui`: page shell frame and header registry, page primitives, empty and sign-in states,
  loading spinner, page skeletons, and the file uploader presentation.
- `component-models`: the provider icon registry and `ProviderGlyph`, Artificial Analysis panel,
  model options and lists, auto-router picker, hover preview, and the controlled selector trigger
  and panel.
- `component-navigation`: sidebar parts, settings popover, theme and more-options menus,
  conversation list and controls, storage notice, and the search dialog.
- `component-capabilities`: capability and app cards, experience grid, capability theme helpers,
  dynamic tool form, tool configuration dialog, tool result card, and the recipe card and dialogs.
- `component-content`: generated response views, artefact classification, actions, callout, inline
  preview, document editor, and the sandboxed artefact renderers.
- `component-conversation`: message content, actions, tool and function messages, citations,
  reasoning, search grounding, connector approval, agent trace, composer input and menus, council
  controls, keyboard shortcuts, and the welcome screen.
- `component-account`: account sidebar shell, agent, team, connector, and provider views, the user
  settings form, and the provider and connector credential modals.
- `component-workspaces`: workspace and project cards, member, invitation, governance, knowledge,
  coding environment, and activity views, Work sidebar navigation, and the create/invite dialogs.
- `component-experiences`: article, note, and podcast presentation under `/content`; canvas and
  drawing under `/media`; the Strudel player under `/music` with the runtime as an optional peer;
  training panels and forms under `/training`.

Shared behaviour moved below the render layer:

- `schemas`: chat modes, model selection, region variants, provider display, token formatting,
  auto-router modes, reasoning helpers, recipe presentation, article report contracts, connector
  approval parsing, and model tool configuration parsing.
- `library-chat`: the conversation message contract plus message, artefact, agent-trace, opinion,
  branching, compaction, speech, composer-command, and tool-result helpers, each on its own subpath.
- `utility-core` gains `generateId`, `formatBytes`, and `getErrorMessage`; `utility-react` gains
  `useFileUpload` and `containsEventTarget`.
