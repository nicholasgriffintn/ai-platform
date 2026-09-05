# Discover tour beneath the guest home and on its own page

- **Change:** Guests see a six-band tour under the welcome screen on the home route; the same bands render at `/discover` with anchors; a Discover segment appears on the standard sidebar for everyone and on the chat sidebar for guests. Home meta description and structured data describe the product; the sitemap lists discover, pricing and pets.
- **Surfaces:** Web home and chat routes when signed out, `/discover`, the standard sidebar on pricing, pets, terms and privacy, the chat sidebar when signed out.
- **Prerequisites:** None. Bands read the public models, capabilities and plans endpoints.
- **Risk if wrong:** The tour could appear for a member or push the composer, a band could render empty or error for guests, or a sidebar link could point at a page that prompts for sign-in.
- **Commits:** None yet.

## Verify

- [ ] Signed out, open `/`. Confirm the welcome title and composer fill the first screen with no tour content visible until you scroll, then a "Keep scrolling for the tour" eyebrow and six bands: Chat and Work, models, capabilities, pets, pricing, keys. Confirm the models band shows provider glyphs and featured model chips, the capabilities band shows experience cards with icons, the pets band animates the flock, and the pricing band shows every plan with its price.
- [ ] Type into the composer and send a message as a guest. Confirm the tour disappears once the conversation starts and does not return within that conversation.
- [ ] Sign in and open `/`. Confirm no tour renders and the chat sidebar carries no Discover segment. Open `/pricing` and confirm the standard sidebar shows Discover with Tour, Pets and Pricing.
- [ ] Signed out, open the chat sidebar. Confirm Discover appears under New chat and Search with Tour, Pets and Pricing, that Tour opens `/discover`, and that on mobile the sidebar closes after following a link.
- [ ] Open `/discover`. Confirm the page title, the section chips, and that each chip scrolls to its band with the heading clear of the header. Confirm `/discover#pricing` lands on the pricing band directly.
- [ ] Throttle the network and reload `/` signed out. Confirm the composer is usable before the tour module arrives, and that the tour appears without moving the composer.
- [ ] Check the home page source: the meta description and structured data describe chat, Work and agents rather than "multiple AI models".

**Stop and report if:** The tour renders for a member or above the composer, a band throws or stays in its skeleton state, or a sidebar Discover link lands on a sign-in prompt.
