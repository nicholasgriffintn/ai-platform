# Public capabilities catalogue and aligned standard sidebar

- **Change:** A public `/capabilities` page lists built-in experiences, model tools, every function tool with Pro and own-keys badges, and recipe templates with their connected services, then explains that agents, skills and installed recipes are curated per person or workspace. It reads a new public `GET /capabilities/catalogue` endpoint; the signed-in `/chat/capabilities` library is unchanged. The tour band and the Discover sidebar segment link to it. The standard sidebar's Back to Home link now uses the same nav primitives as the Discover links so icons and labels align.
- **Surfaces:** `/capabilities`, the tour capabilities band, the standard sidebar on every non-chat page.
- **Prerequisites:** None.
- **Risk if wrong:** A Pro-only or own-keys tool could be shown without its badge, a recipe could list an integration with a missing glyph, or the page could expose a tool the signed-in library hides for a reason other than plan.
- **Commits:** None yet.

## Verify

- [ ] Signed out, open `/capabilities`. Confirm the lede counts experiences, tools and recipe templates, and the section chips scroll to Experiences, Model tools, Function tools, Recipes and Curated by you.
- [ ] Compare Function tools against the signed-in library on a free account: the public page should list more tools, with Pro badges on the premium ones and Your keys badges on the bring-your-own-key ones.
- [ ] Confirm each recipe card shows its category, whether it automates or integrates, and chips for its connected services with glyphs.
- [ ] Confirm the Curated by you section shows Sign in to start curating when signed out and Open your capabilities when signed in, and that the latter opens `/chat/capabilities`.
- [ ] Open `/pricing` or `/models` and confirm the sidebar's Back to Home icon and label line up exactly with the Discover links beneath, including the Discover heading's left edge.
- [ ] Check `/capabilities` at 390px: cards stack with the icon above the title and the section chips wrap.

**Stop and report if:** A premium tool appears without a Pro badge, a recipe card lacks its services, or the sidebar items still sit at different indents.
