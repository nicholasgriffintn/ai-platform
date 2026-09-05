# Public models catalogue and the credit ladder on pricing

- **Change:** A public `/models` page lists every non-deprecated, non-hidden model grouped by provider, with badges for featured, free, beta and open weights, input modalities and context size, and provider anchors. The Discover sidebar segment and the tour's models band link to it. The pricing page replaces the credit examples list with a logarithmic ladder and uses the display face for its headings.
- **Surfaces:** `/models`, the standard sidebar Discover segment, the tour models band, `/pricing`.
- **Prerequisites:** None. The page and the tour band read the new public `GET /models/catalogue` endpoint, which returns every model without filtering by the caller's access; the picker still uses `GET /models`.
- **Risk if wrong:** A provider without a registered glyph could show an empty square, a model without a name could render blank, or the ladder widths could misrepresent the examples.
- **Commits:** None yet.

## Verify

- [ ] Signed out, open `/models`. Confirm the heading, a live count of models and providers in the lede, and a row of provider chips that each scroll to their section with the heading clear of the header.
- [ ] In each provider section, confirm every card shows an icon or initial, a name, and where the registry has them a description, input modalities and a context size such as "128k tokens". Confirm Featured, Free, Beta and Open weights badges match the picker's knowledge of those models.
- [ ] Confirm no deprecated or hidden model appears by comparing one deprecated entry from the registry against the page.
- [ ] Open the sidebar on `/models` and confirm Discover lists Tour, Models, Pets and Pricing with Models highlighted. From the home tour, follow "Browse the catalogue" and confirm it lands here.
- [ ] Open `/pricing`. Confirm the ladder shows three rungs whose bars grow with each order of magnitude, that the credits column uses tabular figures, and that the page headings render in the display face.
- [ ] Check `/models` at 390px width: cards stack in one column and provider chips wrap without horizontal scrolling.

**Stop and report if:** A card renders with no name, a provider chip scrolls to the wrong section, or the ladder's largest rung is not the widest.
