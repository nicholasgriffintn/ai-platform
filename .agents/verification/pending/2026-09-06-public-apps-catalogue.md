# One public catalogue, tried before it is joined

- **Change:** The public catalogue existed twice, at `/capabilities` and at `/apps`, with overlapping content and different vocabulary. There is now one page at `/apps`, listing apps, teammate roles, automations, model tools and function tools, and explaining what stays curated per person. Every app and teammate card carries the ask already written: following it opens a conversation with that text in the composer, and the query parameter is cleared so a refresh does not retype it. `/capabilities` is gone rather than redirected.
- **Surfaces:** Web app only. No API, schema or database change.
- **Prerequisites:** None. The page must work signed out.
- **Risk if wrong:** A deep link putting text into an existing conversation's composer, the page requiring sign-in, or a Pro-only or own-keys tool shown without its badge.

## Verify

- [ ] Open `/apps` in a private window. Confirm it renders with no sign-in prompt, and that Apps, Teammates, Automations, Model tools, Function tools and Curated by you all appear.
- [ ] Confirm each app card says when to reach for it, what it works from and what it leaves behind.
- [ ] Confirm a Pro-only function tool shows its Pro badge and an own-keys tool shows Your keys.
- [ ] Confirm an automation lists its connected services with their glyphs.
- [ ] Follow one app card's link. Confirm the composer opens with that ask typed and the address bar no longer carries the prompt.
- [ ] Follow one teammate card's link and confirm the same.
- [ ] Refresh after following a link. Confirm the composer is not retyped.
- [ ] Follow a link while a conversation is already open and confirm nothing is sent, only typed.
- [ ] Confirm `/capabilities` is a 404 and that the Discover tour and sidebar both point at `/apps`.
- [ ] Confirm a hand-written very long `prompt` parameter is truncated rather than breaking the page.

**Stop and report if:** a deep link sends a message rather than typing one, or `/apps` demands sign-in.
