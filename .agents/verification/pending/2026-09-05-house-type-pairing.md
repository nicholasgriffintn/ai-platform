# House type pairing across the web application

- **Change:** Self-hosted Fraunces (display), IBM Plex Sans (body) and IBM Plex Mono (utility) replace the system font stack through three font tokens; the welcome title, page titles and theme picker names use the display face; eyebrow labels use a shared mono style.
- **Surfaces:** Every web page; conversation welcome, page headers, Customisation theme picker, model chips and code.
- **Prerequisites:** None. The fonts are static assets under `/fonts` served from the origin.
- **Risk if wrong:** A missing or blocked font file falls back to the system stack silently; a layout shift on swap could move the composer; a heading in the display face could clip in a narrow header.
- **Commits:** None yet.

## Verify

- [ ] Load the app with the network panel open. Confirm requests for `/fonts/*.woff2` return 200 from the origin, that no request goes to a font host, and that no console line reports a content security policy violation for fonts.
- [ ] On the home welcome screen, confirm the title renders in a serif display face and the body copy and suggestions in a sans face distinct from the operating system default. Reload with a throttled connection and confirm the composer does not move when the fonts swap in.
- [ ] Open Profile and Work. Confirm page titles use the display face at a size that fits the header without clipping, on desktop and at 390px width.
- [ ] Open Customisation and confirm the theme names use the display face and the appearance captions use the mono eyebrow style.
- [ ] Open a conversation with a code block and the model picker. Confirm code and model labels render in the mono face.
- [ ] Repeat the welcome screen in Light, Paper and Fern to confirm the display face weight reads well on both light and dark canvases.

**Stop and report if:** Any text falls back to a system font while the font files return 200, the composer shifts on font swap, or a title clips.
