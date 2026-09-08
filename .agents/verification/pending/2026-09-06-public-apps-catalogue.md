# One public catalogue, tried before it is joined

- **Change:** The public catalogue existed twice, at `/capabilities` and at `/apps`, with overlapping content and different vocabulary. There is now one page at `/apps`, listing apps, teammate roles, automations, model tools and function tools, and explaining what stays curated per person. Every app and teammate card carries the ask already written: following it opens a conversation with that text in the composer, and the query parameter is cleared so a refresh does not retype it. `/capabilities` is gone rather than redirected.
- **Surfaces:** Web app only. No API, schema or database change.
- **Prerequisites:** None. The page must work signed out.
- **Risk if wrong:** A deep link putting text into an existing conversation's composer, the page requiring sign-in, or a Pro-only or own-keys tool shown without its badge.

## Verify

- [x] Open `/apps` in a private window. Confirm it renders with no sign-in prompt, and that Apps, Teammates, Automations, Model tools, Function tools and Curated by you all appear.
- [x] Confirm each app card says when to reach for it, what it works from and what it leaves behind.
- [x] Confirm a Pro-only function tool shows its Pro badge and an own-keys tool shows Your keys.
- [x] Confirm an automation lists its connected services with their glyphs.
- [x] Follow one app card's link. Confirm the composer opens with that ask typed and the address bar no longer carries the prompt.
- [x] Follow one teammate card's link and confirm the same.
- [x] Refresh after following a link. Confirm the composer is not retyped.
- [x] Follow a link while a conversation is already open and confirm nothing is sent, only typed.
- [x] Confirm `/capabilities` is a 404 and that the Discover tour and sidebar both point at `/apps`.
- [x] Confirm a hand-written very long `prompt` parameter is truncated rather than breaking the page.

**Stop and report if:** a deep link sends a message rather than typing one, or `/apps` demands sign-in.

## Automated evidence — 7 September 2026

- Local Chromium `features/public-catalogues.spec.ts` passes signed out against the real catalogue response.
- It renders every section, checks one app card's when/works-from/leaves-behind sentence, the Pro and Your keys badges, and an automation's Connected services list with one entry per declared integration.
- Following an app card and a teammate card each types the ask into the composer, leaves the address bar without the `prompt` parameter, sends no completion request, and leaves the composer empty after a reload.
- A 2,500-character `prompt` parameter renders truncated to the 2,000-character cap.
- `/capabilities` now answers 404 rather than 200 with the not-found page; the Discover teammates band and the sidebar entry both open `/apps`.
- A logged-out Chromium journey now follows an app link from an already-open conversation, confirms the ask is typed into the composer, and observes zero completion requests.
