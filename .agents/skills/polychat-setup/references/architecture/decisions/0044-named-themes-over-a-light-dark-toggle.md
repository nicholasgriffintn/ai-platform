# ADR 0044: Name themes and resolve them from one attribute

Status: Accepted.

This decision defines how presentation themes are declared, resolved and consumed. The `light`, `dark` and `blue` palettes, the customisation picker and the shared token layer implement it.

Polychat previously had a light/dark toggle whose two palettes lived under `:root` and `.dark`. A toggle cannot express more than two looks, and feature code reached past the tokens to raw Tailwind palette classes with paired `dark:` overrides, so a third palette would have had no way to reach most of the interface.

## Decision

A **theme** is a named palette with a declared appearance. `packages/component-ui/src/theme.ts` is the registry: it owns the identifiers, labels, appearance and storage key, and it derives the pre-paint bootstrap script from the same data. A **theme preference** is what the person chose and may be `system`; a **theme id** is what that resolves to against `prefers-color-scheme`.

Themes are selected by `data-polychat-theme` on the document element. Each theme is one block of `--polychat-*` declarations in `packages/component-ui/src/styles.css`; `:root` carries the light palette so a document without the attribute is still styled. The matching `dark` or `light` class is applied alongside the attribute so Tailwind's `dark:` variant keeps working, but it never selects tokens. Adding a theme means adding a registry entry and one attribute block, and nothing else.

Because the attribute scopes tokens rather than the root alone, a subtree may declare its own theme. The customisation picker uses this to render each option in its own palette instead of hardcoding preview colours.

Feature code consumes semantic roles — surface, text, border, focus, and the state roles for active work, human action, success, attention, failure and creative. Identity colour is separate: capability and provider accents resolve through `--polychat-accent-*`, where each hue carries a fixed chroma that stays inside sRGB and each theme supplies one lightness. Raw Tailwind palette classes and paired `dark:` overrides are not a supported way to colour the interface.

Each theme also declares its canvas as a plain hex so the `theme-color` meta can carry it; that meta cannot reference a custom property, so this one value is deliberately duplicated from the canvas token and must be changed with it.

Theme preference is device state, not account state. It is held in a store, persisted to local storage, and applied before first paint by the bootstrap script so a stored theme does not flash through the server-rendered default.

## Trade-off

Every palette must be authored and checked against contrast and sRGB gamut for each theme rather than inherited from Tailwind's ramps, and a new theme needs that work before it can ship. Adding an identity hue means choosing a chroma that survives every theme's lightness. The declared `theme-color` hex can drift from its canvas token, and nothing in the build catches that. In return one attribute drives the whole interface, previews are real rather than illustrative, and a third palette needed no changes to feature code.
