# ADR 0100: Sites borrow reference tokens, not layouts

Status: Implemented.

## Problem

People often describe the site they want by pointing at one they like, such as "make it look like our marketing site". Sites offered eight named palettes and four font sets, so the closest it could get was a guess from the brief. The result rarely matched a brand's actual colours or type, and fixing it meant hand-editing the theme.

## Decision

A site build can take a public HTTPS reference URL. The computer sandbox opens the page in its browser and blocks images, media, and private or non-HTTPS requests. It reads only computed styles: the body background and text colour, the colours of visible buttons, links and headers weighted by area, and the heading and body font families. It returns those values, never the page's markup or copy.

The API turns the capture into theme tokens:

- The heaviest saturated accent sets the primary hue and chroma.
- The background sets the neutral hue and the light or dark mode.
- The nearest named palette is kept as the fallback.

Font families are unwrapped from framework hashes and generic families are dropped. A family is kept only when Google Fonts serves it at weights 400 and 700, so the stylesheet request never fails. The theme stores the result as optional `customPalette` and `customFonts`, which render over the named palette and font stack. Explicit theme choices in the request win over the reference.

Reference reads need a Pro account and a sandbox worker, like browser checks. A failed read fails the build with a clear error. It never silently builds with guessed colours.

## Consequences

Sites can match a brand's colours and type without copying its layout or content, so generated sites stay original. Each build that names a reference costs one short computer session. Pages that only show their colours after interaction, or hide styles behind consent walls, give weaker tokens. Fonts that are not on Google Fonts fall back to the named stack.
