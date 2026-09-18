# Designing visual artifacts

Load this reference for `text/html`, `application/vnd.react`, and `image/svg+xml` — anything with a visual surface.

## Match the treatment to the request

Most requests want something **clear and well made**, not something expressive: a dashboard, a summary page, a demo, a tool. Give those real typographic hierarchy, considered spacing, and a deliberate palette — and stop there. Skip the full-bleed hero, the scroll animations, the gradient.

A few requests are genuinely editorial — a landing page, a game, something the user will show people. Those earn a point of view.

When in doubt, well-composed is never wrong; over-designed sometimes is.

## Before writing, fix three things

1. **Colour** — four to six values you can name. Pick the neutral deliberately: a grey nudged toward the accent reads as chosen; a pure mid-grey reads as a default.
2. **Type** — a scale, and roles for each face. Keep running text near 65 characters. Give headings `text-wrap: balance` and uppercase labels a little letter-spacing. Remember webfonts do not load; a considered system stack is the honest choice.
3. **Layout** — one sentence describing the structure.

Then build from that, and derive every colour and size decision from it.

## Both themes, always

The artifact renders on whatever ground the surrounding interface paints. Define your colours as custom properties on `:root`, redefine only those properties under `@media (prefers-color-scheme: dark)`, and reference them everywhere else. Two failures account for nearly every unreadable artifact:

- A colour whose only declaration sits inside the dark-mode block, so it never applies in light mode.
- A transparent `body`, which silently borrows the host's background and puts one theme's text on the other theme's ground. Always set `background` on `body` from a token.

A design that deliberately commits to a single look — a terminal, a letterpress invitation — may skip the media query, but must still paint background and every colour explicitly. Make it a choice, not an omission.

## Build cleanly

- Space siblings with flex or grid `gap`, not per-element margins that collapse or double.
- Wide content — tables, code, diagrams — gets `overflow-x: auto` on its own container. The page body must never scroll sideways.
- `font-variant-numeric: tabular-nums` wherever digits line up in a column.
- Give keyboard focus a visible state and respect `prefers-reduced-motion`.
- Watch selector specificity. It is easy to write two rules that quietly cancel each other's spacing.
- For generative or decorative graphics, reach for Canvas rather than hand-authoring long SVG path data.

## When it is a tool, not a document

A dashboard is scanned and operated, not read top to bottom. Summary before detail. Encode state in form as well as number — a pill, a chip, a severity stripe — so what needs attention reads at a glance. Semantic colour (good, warning, critical) is separate from the accent and does not count as it. What is interactive should look interactive.

## Words are design material

Name things the way the user would: a person manages _notifications_, not _webhook config_. Active voice. A button says what happens, and the confirmation says it happened. Errors say what went wrong and how to fix it. Structural devices — numbering, eyebrows, dividers — should encode something true about the content; number a list only when the order actually matters.

## Avoid the house style of generated design

Cream backgrounds with a serif display face and a terracotta accent; near-black with one acid-green pop; purple-to-blue gradient heroes; Inter or Space Grotesk as the safe pick; emoji as section markers; everything centred; rounded cards with an accent rail. If the user asks for one of these, give it to them exactly. Where nothing is specified, spend the freedom somewhere better.

## SVG diagrams specifically

Draw the mechanism, not a box-and-arrow restatement of the label. Set `viewBox`, never fixed width and height. Use `currentColor` or CSS custom properties for strokes and fills so the diagram survives both themes. Keep text at 12px or larger in the coordinate system and never rely on a font that has to load.
