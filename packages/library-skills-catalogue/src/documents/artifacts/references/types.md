# Artifact types

Load this reference before writing HTML, React, SVG, or any artifact whose type is unclear.

## Prose and documents

**`text/markdown`** — reports, plans, briefs, essays, letters, emails, notes. Opens as an **editable document artifact**, so this is the type for anything the user will revise or send. Default choice for prose.

**`text/plain`** — only when Markdown formatting would be wrong (a raw config, a fixture, a body of text that must stay literal).

## Code

**`application/vnd.code`** — any source code in any language. Always set `language`, e.g. `language="python"`. Shows the source with highlighting; nothing executes.

Use this for HTML, CSS, JSX or SVG **source** the user wants to read or copy. The rendering types below hide the source, which is wrong when the code is the deliverable.

## Rendered output

These run inside a sandboxed iframe with a strict content security policy:

- No network at runtime. `fetch`, `XMLHttpRequest`, and WebSockets are blocked. There is no API to call, no CDN font, no remote JSON.
- Images and media must be `data:` or `blob:` URIs. **There are no placeholder image URLs.** Draw placeholders as inline SVG or a styled element.
- Fonts must be `data:` URIs. A linked webfont fails silently to a system fallback, so prefer a well-chosen system stack unless the face genuinely matters.
- The only external script origin is `https://cdnjs.cloudflare.com`. Nothing else loads.
- No web workers, no forms that submit, no navigation away from the page.
- `localStorage`, `sessionStorage` and `caches` exist but are in-memory mocks. State does not survive a reload — never tell the user their work is saved.

**`text/html`** — a complete single-file page. HTML, CSS and JS inline in one artifact. Renders in the artifact panel with the source available.

Add `display="inline"` to render it directly in the chat thread as a preview, with the source hidden. Use inline for a visualisation, a small interactive demo, or a custom interface the user should simply look at. Omit `display` when the user should read or copy the code.

**`image/svg+xml`** — diagrams, charts, icons, any static graphic. Set `viewBox` and let it scale; do not fix width and height. **This is the right type for diagrams** — flowcharts, architecture, sequence, timeline.

**`application/vnd.react`** — an interactive React component, when interaction is the point and plain HTML cannot express it.

- React 18 is available. Import hooks normally: `import { useState } from "react"`. TypeScript syntax is allowed and stripped.
- `recharts` is available for charts: `import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts"`.
- **Nothing else is available.** No Tailwind, no lucide-react, no shadcn/ui, no utility libraries. Any other import fails to render. Style with inline styles, a `<style>` element, or a companion `text/css` artifact.
- The component takes no required props and must be the default export.
- If any of that is a problem, write plain `text/html` instead — it is less machinery and fails less often.

### Live data

A React artifact can show live data from the user's connected tools instead of a snapshot. Use it when the artifact is a view the user will open again: a dashboard, a tracker, a list of open items. Never paste values you fetched earlier into the code when a live read would do; a pasted number is stale the next time the page opens.

Declare every read at the very top of the artifact, before the code, in a `<bindings>` block holding a JSON array:

```text
<artifact identifier="devin-sessions" type="application/vnd.react" title="Devin sessions">
<bindings>[{"id":"sessions","provider":"devin","operation":"list_sessions","args":{"organizationId":"org_123"},"label":"Open sessions"}]</bindings>
import { usePolychatData } from "@polychat/data";

export default function Sessions() {
  const { data, error, loading, refetch } = usePolychatData("sessions");
  ...
}
</artifact>
```

- `provider` and `operation` are a connected connector and one of its **read** operations, named exactly as `use_recipe_connector` names them. Operations that send, create, update or delete are refused.
- `args` are the operation's arguments. Up to eight bindings per artifact.
- `usePolychatData(id)` returns `{ data, error, loading, refetch }`. Always render a loading state and an error state, and write defensively against the response shape.
- `refetch(args)` re-runs the read with new values for **arguments you declared**. It cannot add new arguments, and it should never run in an effect that fires every render.
- Reads are cached for a minute and rate-limited per artifact. Live data only loads inside the conversation that made the artifact.

**`text/css`** — a stylesheet companion to an HTML or React artifact in the same message. The two are combined when rendered. This is the one legitimate reason to emit two artifacts at once.

## Not supported

**Mermaid.** Mermaid source does not render as a diagram here; it renders as a broken component. Draw diagrams as `image/svg+xml`, or put the Mermaid source in `application/vnd.code` with `language="mermaid"` if the user explicitly asked for Mermaid source.

**Multi-file projects.** Everything is single-file. For a project with real structure, put the primary file in an artifact and give the rest as fenced blocks with their paths.
