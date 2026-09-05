# ADR 0054: Ship a house type pairing through font tokens

Status: Accepted.

This decision defines which typefaces Polychat renders in and where a component may ask for one. The self-hosted faces under `apps/app/public/fonts`, the font tokens in `packages/component-ui/src/styles.css` and the display, sans and mono utilities implement it.

Polychat rendered entirely in the operating system's sans-serif. Headings, body and code shared one face, and code and model labels asked for `font-mono` without any face being loaded, so the interface had no typographic identity and read differently on every platform.

## Decision

Three roles, three tokens. `--polychat-font-display` is for titles and welcome copy, `--polychat-font-body` for everything read at length, and `--polychat-font-mono` for eyebrows, model chips, shortcuts and code. `packages/component-ui/src/styles.css` declares the tokens with system fallback stacks so a host that loads nothing still renders sensibly. The web host loads Fraunces for display, IBM Plex Sans for body and IBM Plex Mono for utility, overrides the three tokens, and maps them to Tailwind's `font-display`, `font-sans` and `font-mono` utilities. Components use those utilities or the `polychat-eyebrow` class and never name a family.

Faces are self-hosted as latin woff2 subsets with `font-display: swap`. The content security policy allows fonts from the origin only, and that stays as it is; no font host is added.

The display face is brand language rather than landing-page decoration, so it recurs, but rarely and by role: the conversation welcome title, page heroes and section titles on public pages, empty-state titles and the theme picker names. It never appears in the header bar, navigation, controls or body copy. Conversation body copy is set at weight 400 with a line height of 1.6 through the shared markdown prose tokens, which also map the typography plugin's colours to the theme rather than to a fixed grey ramp. iOS keeps its own type until its design is settled, and follows the web pairing only if that design adopts it.

## Trade-off

Self-hosting adds roughly 230 KB of font assets to the first visit and a swap on slow connections, in exchange for one identity across platforms and no third-party request. Fraunces is a variable font with an optical size axis, so headings and picker names read differently at 24px and 48px on purpose; a static face would be lighter but flatter. Every new heading is a decision about which role it belongs to rather than an inheritance.
