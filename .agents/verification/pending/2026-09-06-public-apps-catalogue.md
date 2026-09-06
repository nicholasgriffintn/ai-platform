# The catalogue can be tried before it is joined

- **Change:** A public page at `/apps` lists the built-in Apps and every built-in teammate role, without sign-in. Each card carries the ask already written: following it opens a conversation with that text in the composer, and the query parameter is cleared so a refresh does not retype it. The existing `/capabilities` page keeps its catalogue and now shares the card and section primitives rather than owning private copies of them.
- **Surfaces:** Web app only. No API, schema or database change.
- **Prerequisites:** None. The page must work signed out.
- **Risk if wrong:** A deep link putting text into an existing conversation's composer, or the page requiring sign-in.

## Verify

- [ ] Open `/apps` in a private window. Confirm it renders with no sign-in prompt, and that Apps and every teammate category appear.
- [ ] Confirm each App card says when to reach for it, what it works from and what it leaves behind.
- [ ] Follow one App card's link. Confirm the composer opens with that ask typed and the address bar no longer carries the prompt.
- [ ] Follow one teammate card's link and confirm the same.
- [ ] Refresh after following a link. Confirm the composer is not retyped.
- [ ] Follow a link while a conversation is already open and confirm nothing is sent, only typed.
- [ ] Confirm `/capabilities` still renders every section and that its cards are unchanged.
- [ ] Confirm a hand-written very long `prompt` parameter is truncated rather than breaking the page.

**Stop and report if:** a deep link sends a message rather than typing one, or `/apps` demands sign-in.
