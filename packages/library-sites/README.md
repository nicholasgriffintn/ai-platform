# @ngriffin_uk/polychat-library-sites

The pure core of Polychat Sites. It never calls a model and runs the same in the API, the browser and tests.

Sites work the way json-render proved generative UI should: a model can only use components from a catalogue, it streams a flat document one JSON Patch line at a time so the UI fills in progressively, and the same document compiles to real code. This package owns each of those pieces for Polychat.

## Pieces

- `SITE_CATALOG` — every component the model may use, with zod props, a description and example props. Props are enumerated on purpose: no freeform class names, no invented wrappers.
- `describeSiteCatalog()` / `buildSiteExampleStream()` — the catalogue rendered as prompt text, and a worked example built from the live definitions so the prompt never drifts from the code.
- `createSitePatchStreamReader()` / `applySitePatch()` — the JSONL patch protocol. Lines arrive in any chunking, prose and fences are ignored, and `add`, `replace` and `remove` build the document in place.
- `validateSiteProject()` — turns the streamed document into a typed `SiteProject`, dropping unknown components, invalid props, dangling children and unreachable elements while recording each repair as an issue. Only a site with no pages is an error.
- `SITE_PLAN_QUESTIONS` / `resolveSitePlan()` — the Jev question set and the mapping from calibrated answers (or heuristics when no decision model is available) to a plan: kind, scope, tone, theme and the model tier that should write the site.
- `buildSiteThemeVariables()` / `renderSiteThemeCss()` — palettes as oklch token sets for the preview wrapper and the exported `globals.css`.
- `generateSiteFiles()` — a deterministic Next.js and Tailwind v4 project: pages composed from the document, one component file per catalogue entry used, theme, layout and README. It depends only on `next`, `react`, `lucide-react`, `clsx` and `tailwind-merge`.
- `buildSiteSandboxTask()` — the feature-implementation task that hands those files to the sandbox worker.

## Document shape

```json
{
  "title": "Acme",
  "description": "Invoicing for small studios.",
  "theme": { "palette": "ocean", "font": "sans", "radius": "md", "mode": "light" },
  "pages": {
    "home": {
      "path": "/",
      "title": "Home",
      "root": "page",
      "elements": {
        "page": { "type": "Page", "props": {}, "children": ["nav", "hero"] },
        "nav": { "type": "Navbar", "props": { "brand": "Acme", "links": [] }, "children": [] },
        "hero": { "type": "Hero", "props": { "headline": "Ship it" }, "children": [] }
      }
    }
  }
}
```

The model streams that document as lines such as `{"op":"add","path":"/pages/home/elements/hero","value":{...}}`. Refinement sends the current document and expects `replace` and `remove` operations against it.

## Conventions

- The live renderer in `component-sites` and the codegen templates here implement the same components with the same Tailwind classes. Change both when a component changes; the catalogue test renders every example through both.
- Keep every prop enumerated. A new visual option is a new enum value, never a class name.
- Image `src` is optional and stays empty unless the brief supplies a real URL; a labelled placeholder renders instead.
