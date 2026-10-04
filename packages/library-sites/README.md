# @ngriffin_uk/polychat-library-sites

The pure core of Polychat Sites. It never calls a model and runs the same in the API, the browser and tests.

Sites work the way json-render proved generative UI should: a model can only use components from a catalogue, it streams a flat document one JSON Patch line at a time so the UI fills in progressively, and the same document compiles to real code. This package owns each of those pieces for Polychat.

## Pieces

- `SITE_CATALOG` — every component the model may use, with zod props, a description and example props. Props are enumerated on purpose: no freeform class names, no invented wrappers.
- `describeSiteCatalog()` / `buildSiteExampleStream()` — the catalogue rendered as prompt text, and a worked example built from the live definitions so the prompt never drifts from the code.
- `createSitePatchStreamReader()` / `applySitePatch()` — the JSONL patch protocol. Lines arrive in any chunking, prose and fences are ignored, and `add`, `replace` and `remove` build the document in place.
- `validateSiteProject()` — turns the streamed document into a typed `SiteProject`, dropping unknown components, invalid props, dangling children and unreachable elements while recording each repair as an issue. Only a site with no pages is an error.
- `SITE_PLAN_QUESTIONS` / `resolveSitePlan()` — the Jev question set and the mapping from calibrated answers (or heuristics when no decision model is available) to a plan: product kind, scope, capabilities, tone, visual direction and the model tier that should write it.
- `buildSiteFastRefineCandidates()` / `resolveSiteFastRefineCandidate()` — bounded selected-element visual and enum-prop edits that Jev may apply directly only at high confidence. Ambiguous, compound, textual, structural and behavioural requests remain coding-model work.
- `buildSiteThemeVariables()` / `renderSiteThemeCss()` — palettes as oklch token sets for the preview wrapper and the exported `globals.css`.
- `siteElementStyleClasses()` — the structured composition grammar for width, spacing, local palette and tone, surface, alignment, borders, shadows, radii, motion, bleed and sticky positioning. It gives the model expressive control without accepting arbitrary class names.
- `generateSiteFiles()` — a deterministic React Router, Next.js or TanStack Router project with Tailwind v4. React Router is the default. Pages, state, components, theme and expressive styles come from the same framework-neutral document.
- `buildSiteSandboxTask()` — the feature-implementation task that hands those files to the sandbox worker.

## Document shape

```json
{
  "title": "Acme",
  "description": "Invoicing for small studios.",
  "theme": {
    "palette": "ocean",
    "font": "sans",
    "radius": "md",
    "mode": "light",
    "direction": "editorial",
    "density": "spacious",
    "texture": "grain",
    "motion": "restrained"
  },
  "capabilities": ["content", "navigation", "forms"],
  "pages": {
    "home": {
      "path": "/",
      "title": "Home",
      "root": "page",
      "elements": {
        "page": { "type": "Page", "props": {}, "children": ["nav", "hero"] },
        "nav": { "type": "Navbar", "props": { "brand": "Acme", "links": [] }, "children": [] },
        "hero": {
          "type": "Hero",
          "props": { "headline": "Ship it" },
          "children": [],
          "style": { "width": "wide", "spacing": "dramatic", "motion": "rise" }
        }
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

## Bind scoped data

Keep live records and connector results outside the page document. Declare collections and bind their records, or an existing Source containing a JSON list, to a page's state path.

```json
{
  "collections": {
    "tasks": {
      "label": "Tasks",
      "fields": {
        "title": { "type": "string", "required": true },
        "done": { "type": "boolean", "required": false }
      },
      "maxRecords": 1000
    }
  },
  "dataBindings": {
    "tasks": {
      "kind": "collection",
      "collectionId": "tasks",
      "pageId": "home",
      "statePath": "/tasks"
    }
  }
}
```

Read those rows through `{ "$state": "/tasks" }`. Submit a Form with `{ "action": "createRecord", "params": { "collectionId": "tasks", "values": { "$form": true } } }`. Use a row's `id` and `revision` as `recordId` and `expectedRecordRevision` for `updateRecord` or `deleteRecord`; use `refreshData` to reread current records.

Enable saved records in Studio after generating the collection. Storage is isolated per site, persists between visits and is disabled until explicitly enabled. Refreshes replace only bound state paths, so local search and filter state survives.

Project members can read records and create their own. Only a record's creator or a project owner/admin can update or delete it. Changing the app or enabling storage requires the app's creator or a project owner/admin. Disabling storage preserves records; deleting the site deletes its storage.

Use `manage_site` to create a connector snapshot. Select an exact connected account and a supported read operation, specify the list's `resultPath`, and project nested values into named fields with `fields`. The service saves a scoped Source, rechecks current account and project/teammate authority before publishing, and never embeds credentials or result rows in the site specification. Refresh the saved connector source from Studio; ordinary JSON sources can also be attached there.

Bound data supports at most 500 Source rows, 40 primitive fields per row and 250,000 characters per snapshot. Collections support 20 declarations, 1,000 records per collection, 5,000 records per site and 16,000 characters per record. Bindings must use distinct, non-overlapping state paths; required string fields cannot be blank.

## Verify in a browser

Select **Check in browser** in Studio or call `manage_site` with `operation: "verify"`, the current `expectedRevision` and an optional `pageId`. The API checks that page at desktop and mobile widths, records console/page errors, failed required requests, missing content, failed component rendering and horizontal overflow, and stores revision-bound evidence as an Output.

Pass up to five button `interactions` with an `elementKey` and optional `expectVisible` key to check local state changes. Select **Try one repair**, or pass `repair: true`, to allow one coding-model refinement followed by another check. A failed recheck stays failed; unavailable infrastructure never triggers a repair.

Verification requires a Pro account and uses fresh temporary computers, the published preview runtime and approved asset origins. It does not reuse signed-in browser profiles. Cancelling prevents later checks, evidence publication and repair; temporary computers are destroyed when their bounded capture ends. Source data is supplied separately and never written into the saved specification or exported files.

## Connect exported apps

React Router, Next.js and TanStack Router exports include `lib/site-data.ts` when a page uses state. Saved-data actions retain their behaviour, and failed Form saves keep their input. Install an authenticated transport **before mounting the client page**:

```ts
import { createSiteDataTransport } from "./lib/site-data";

let currentSiteRevision = 1;

window.polychatSiteData = createSiteDataTransport({
  baseUrl: "https://api.example.com",
  siteId: "your-saved-site-id",
  projectId: "your-project-id",
  getRevision: () => currentSiteRevision,
  fetchAuthenticated: (url, init) => fetch(url, { ...init, credentials: "include" }),
});
```

Use the existing Polychat session and its permitted API origin, or supply your host's authenticated server proxy. Keep credentials out of generated files. An export without a transport shows an actionable data error; public shared previews cannot mutate or hydrate private records.

Update `currentSiteRevision` after an app edit and update saved records in Studio to activate its current collection schema. Activation checks existing rows and rejects incompatible changes without deleting them. Collection declarations provide a constrained internal-app backend; arbitrary generated server code and public anonymous record access remain outside this contract.
