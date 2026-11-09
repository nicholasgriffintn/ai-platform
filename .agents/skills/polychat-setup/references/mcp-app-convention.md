# MCP App convention

How an MCP server offers a view as a standalone app in Polychat's Apps catalogue. The wire contract is `mcpAppEntryMetaSchema` in `packages/schemas/src/apps.ts`.

## Declare the entry tool

Offer an app with a **tool**, not a new resource type.

```json
{
  "name": "pashi_play_charades",
  "title": "Charades",
  "description": "Act out a word on camera and let the judge guess.",
  "inputSchema": { "type": "object", "properties": {} },
  "annotations": { "readOnlyHint": true },
  "_meta": {
    "ui": { "resourceUri": "ui://pashi/charades" },
    "app.polychat/app": {
      "name": "Charades",
      "description": "Act out a word on camera and let the judge guess.",
      "category": "Play",
      "icon": "drama",
      "theme": "rose",
      "when": "You want a party game on one screen.",
      "uses": "Your camera. A decision model watches a short clip and guesses.",
      "produces": "A round of guesses. Nothing is saved.",
      "surface": "workspace"
    }
  }
}
```

Required, or the tool is not listed:

- `annotations.readOnlyHint` is `true`.
- `inputSchema` has no `required` properties. Polychat opens the app by calling the tool with `{}`.
- `_meta.ui.resourceUri` (or the legacy flat `_meta["ui/resourceUri"]`) is a `ui://` URI. `resources/read` on it returns one content item with `mimeType: "text/html;profile=mcp-app"` and HTML under 1 MB. CSP and permissions come from that content's `_meta.ui`, as for in-chat views.
- `_meta["app.polychat/app"]` is a JSON object. `{}` is enough.
- If the connection uses an `allowed_tools` list, the entry tool is on it.

## Content security policy

Polychat builds the view's policy from the content's `_meta.ui.csp`. Every view may run inline scripts, `blob:` scripts and `blob:` workers and worklets. Network access stays limited to `connectDomains`, and styles, images, fonts and media to `resourceDomains`.

- Views load from a sandbox page on the API origin (`/tools/mcp_app_frames/document`) whose response policy is built from the view's declared domains, so they never inherit Polychat's page policy. Declare every script, style and connect host in `ui.csp`; nothing needs adding to Polychat's own allowlist.
- Set `csp.allowEval: true` only when the view evaluates code at runtime (for example `new Function`). It adds `'unsafe-eval'` and `data:` scripts to that view alone.
- Declare https or wss origins only. Anything else is dropped.

## Marker fields

Every field is optional. A field that is missing, the wrong type or out of range falls back to its default; it never hides the app.

| Field         | Type                                                                                                         | Default                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `name`        | string, 1–80 chars                                                                                           | tool `title`, then `annotations.title`, then tool `name`                          |
| `description` | string, 1–400 chars                                                                                          | tool `description`, then "An app from {server}."                                  |
| `category`    | `"Creative"`, `"Decisions"`, `"Models"`, `"Play"` or `"Tools"` (case-insensitive)                            | `"Tools"`                                                                         |
| `icon`        | an icon name below, or an `https` URL                                                                        | `"app"`                                                                           |
| `theme`       | `"violet"`, `"indigo"`, `"pink"`, `"rose"`, `"cyan"`, `"emerald"`, `"amber"`, `"sky"`, `"slate"` or `"blue"` | `"slate"`                                                                         |
| `when`        | string, 1–240 chars: when to reach for the app                                                               | "You want {name} from {server} on its own page."                                  |
| `uses`        | string, 1–240 chars: what it works from                                                                      | "Your connection to {server}. It can only read through that connection."          |
| `produces`    | string, 1–240 chars: what it leaves behind                                                                   | "Whatever the app shows you. Anything that changes something is asked in a chat." |
| `surface`     | `"workspace"` or `"contained"`                                                                               | `"workspace"`                                                                     |

- **Icon names**: `app`, `audio-lines`, `book-open`, `brain-circuit`, `camera`, `clapperboard`, `code-2`, `dices`, `drama`, `file-text`, `gamepad-2`, `globe`, `graduation-cap`, `image`, `images`, `landmark`, `layout`, `map`, `message-circle-question`, `mic`, `music`, `newspaper`, `palette`, `pencil`, `puzzle`, `search`, `sparkles`, `trophy`, `users`, `video`, `wand-2`.
- **Icon URLs** render only from hosts Polychat's image policy allows (today `https://pashi.app`, `assets.polychat.app` and `https://imagedelivery.net`). Any other host shows the theme's default icon. Prefer a name.
- **Surface**: `workspace` fills the page under a slim Polychat bar with a back link and the app name. `contained` keeps Polychat's page header, back link and description above a tall frame. `layout` is accepted as a legacy alias for `surface`.

## Address

The app opens at `/chat/apps/{server}/{app}`, where `{server}` is the slug of the connection label (`pashi`) and `{app}` is the slug of `name` (`charades`). Two apps with the same slug on one server get `-2`, `-3` in tool-name order. A server whose slug matches a bundled app id gets `-2`. Keep `name` stable so links keep working. Old `mcp-…` links redirect to the readable address.

## What the view gets

- The `ui/initialize` handshake with `hostContext.displayMode: "fullscreen"`, then `ui/notifications/tool-input` with `{ arguments: {} }` and `ui/notifications/tool-result` with the entry tool's result.
- `tools/call` runs only tools marked `readOnlyHint: true`. Anything else returns an error telling the person to ask in a chat.
- `ui/open-link` opens http(s) links in a new window.
- `ui/message` becomes a draft in a new chat.

Remote apps are personal: they use the person's own connection and cannot be added to a project. On iPhone they are listed as web-only.
