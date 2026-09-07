# ADR 0027: Name themes and ship a house type pairing through tokens

Status: Implemented.

## Problem

Polychat had a light/dark toggle whose two palettes lived under `:root` and `.dark`. A toggle cannot express more than two looks, and feature code reached past the tokens to raw Tailwind palette classes with paired `dark:` overrides, so a third palette had no way to reach most of the interface.

The product also rendered entirely in the operating system's sans-serif. Headings, body and code shared one face, and code and model labels asked for `font-mono` without any face being loaded, so the interface had no typographic identity and read differently on every platform.

## Decision

A **theme** is a named palette with a declared appearance. `packages/library-chat/src/theme.ts` is the registry: it owns the identifiers, labels, appearance and storage keys, and derives the pre-paint bootstrap script from the same data. A **theme preference** is what the person chose and may be `system`; a **theme id** is what that resolves to against `prefers-color-scheme`. A **theme pair** names the light and dark themes `system` resolves between, is stored separately from the preference, and is rejected as a whole when either half has the wrong appearance, so a stale value falls back rather than producing a light palette at night.

Themes are selected by `data-polychat-theme` on the document element. Each theme is one block of `--polychat-*` declarations in `packages/component-ui/src/styles.css`, with `:root` carrying the light palette so a document without the attribute is still styled. The matching `dark` or `light` class is applied alongside so Tailwind's `dark:` variant keeps working, but it never selects tokens. Adding a theme means adding a registry entry and one attribute block, and nothing else. Because the attribute scopes tokens rather than the root alone, a subtree may declare its own theme, which is how the picker renders each option in its own palette.

Feature code consumes semantic roles — surface, text, border, focus, and the state roles for active work, human action, success, attention, failure and creative. Identity colour is separate: capability and provider accents resolve through `--polychat-accent-*`, where each hue carries a fixed chroma that stays inside sRGB and each theme supplies one lightness. Raw Tailwind palette classes and paired `dark:` overrides are not a supported way to colour the interface. Each theme also declares its canvas as a plain hex so the `theme-color` meta can carry it; the registry test converts each canvas token to hex, fails when the two drift, and fails when a registered theme has no token block or a block has no registry entry.

Theme preference is device state, not account state. It is held in a store, persisted to local storage, and applied before first paint by the bootstrap script. The server always renders the dark shell and the document element suppresses hydration warnings for the attributes the script rewrites. Because it is device state it must be reachable without an account, so the sidebar settings popover carries a compact theme select for guests and members alike, while the full picker with palette previews lives in Customisation. Anything rendering outside the token layer, such as the toast region, receives the resolved appearance from the host rather than reading the system preference itself.

Type follows the same shape: three roles, three tokens. `--polychat-font-display` is for titles and welcome copy, `--polychat-font-body` for everything read at length, and `--polychat-font-mono` for eyebrows, model chips, shortcuts and code. The same stylesheet declares them with system fallback stacks so a host that loads nothing still renders sensibly; the web host loads Fraunces, IBM Plex Sans and IBM Plex Mono, overrides the three tokens and maps them to the `font-display`, `font-sans` and `font-mono` utilities. Components use those utilities or the `polychat-eyebrow` class and never name a family. Faces are self-hosted as latin woff2 subsets with `font-display: swap`, and the content security policy allows fonts from the origin only.

The display face is brand language rather than landing-page decoration, so it recurs rarely and by role: the conversation welcome title, page heroes and section titles on public pages, empty-state titles and the theme picker names. It never appears in the header bar, navigation, controls or body copy. iOS keeps its own type until its design is settled.

## Consequences

Every palette must be authored and checked against contrast and sRGB gamut for each theme rather than inherited from Tailwind's ramps, and adding an identity hue means choosing a chroma that survives every theme's lightness. The theme pair is a second stored value the bootstrap script and the store must read the same way, which the parity test enforces. In return one attribute drives the whole interface, previews are real rather than illustrative, and further palettes need no changes to feature code.

Self-hosting adds roughly 230 KB of font assets to the first visit and a swap on slow connections, in exchange for one identity across platforms and no third-party request. Fraunces is a variable font with an optical size axis, so headings read differently at 24px and 48px on purpose, and every new heading is a decision about which role it belongs to rather than an inheritance.
