# Produce a pet sprite sheet

An image model cannot place art on an exact pixel grid. Ask one for a sheet and it returns something that reads correctly to a human and drifts by ten to twenty-five pixels per cell, which the player then clips and jitters. Wisp shipped that way: rows crossed their cell seams, one row was blank, and a second nine-row layout was added to the schemas to accommodate the mistake rather than correct it. Treat raw model output as reference art, never as a sheet.

## The contract

Built-in sheets use `polychat-v1` in `packages/schemas/src/pets.ts`. Uploads may also use the nine-row `codex-v1` at 1536 by 1872; that layout exists for accounts bringing sheets cut to it, not for built-ins:

- **Sheet:** 1536 by 2288 pixels, PNG or WebP with a transparent background.
- **Cell:** 192 wide by 208 tall, eight columns by eleven rows.
- **Rows:** one clip each, in `PET_CLIPS` order — idle, blink, preen, greet, think, work, speak, cheer, fret, doze, flit.
- **Frames:** each clip draws its own frame count from column 0 rightwards. Idle, work, fret and flit fill all eight; preen, think, speak and cheer use six; blink, greet and doze use four. Every remaining cell is empty.

Alignment is what makes the grid work:

- **Nothing crosses a seam.** No pixel of a frame may sit on both sides of a cell boundary. This is the failure that clips sprites in the player.
- **One scale for the whole sheet.** Derive a single factor from the largest frame, props included, and apply it everywhere. Scaling frames independently makes the character pulse as clips change.
- **One baseline.** Rest the art near the bottom of the cell — the flock sits around y=175 to y=180 — so pets of different silhouettes stand level beside each other.
- **Motion comes from the art and the pose table.** Bob and lift belong in the frame, not in the grid. `poseFor` in `packages/library-react/src/lib/pet/compose-sheet.ts` holds the offsets the app already uses per clip; reuse those numbers so a hand-built sheet moves like a generated one.

## Draw it, or normalise what you generated

The original flock is flat vector art: bold outlines, no gradients, under 256 colours, palettised to roughly 200 KiB per sheet. Drawing a pet programmatically is the route that satisfies the contract by construction, and it keeps the asset small. Prefer it.

When the character has to come from an image model, generate the art and then re-grid it before committing:

- Segment sprites from the raw image by their own ink, not by the grid you wanted. Project alpha onto each axis to find bands and columns, and discard clusters below a mass threshold so stray specks are not mistaken for frames.
- Separate each frame into its body and its detached props with a connected-component pass. Stripping sparkles or speech marks lets one row of source art serve two clips.
- Compute the single scale, then place each frame centred on the cell and resting on the shared baseline, adding the pose offset for its clip.
- Map source rows to clips by what the art shows. A speech bubble is `speak`, a laptop is `work`, alert marks are `think` or `fret`. Where a clip has no source art, derive it from the nearest frames rather than inventing new drawing — closed eyes make a `blink` and, squashed slightly, a `doze`.
- Pad a clip that is short of frames by ping-ponging back through the source rather than repeating a frame at the seam of a loop.

Soft-shaded raster art does not palettise: quantising Wisp to 256 colours bands the shading badly, so it stays RGBA at about 1.4 MiB. That is the cost of the style, and it is worth knowing before choosing one.

## Check the sheet before committing

Draw the 192 by 208 grid over the finished sheet and look at it. Every fault this document exists to prevent is visible in one glance:

- A sprite touching or crossing a red line is the clipping bug.
- An empty cell inside a clip's frame count, or art in a cell beyond it, is a mis-mapped row.
- A character that changes size down the sheet means the frames were scaled independently.

Compare one row against `pip.png` and `ash.png` at the same cell size to confirm the new pet sits at their scale and baseline.

## Adding a preset

Put the sheet in `packages/component-ui/src/pets/<slug>.png` and register it in two places: the import map in `packages/component-ui/src/Pet/petSheets.ts` and the preset entry in `PET_PRESETS`. A preset may name a `layoutId`, but a built-in should use `polychat-v1` — do not reach for another layout to fit a sheet that came out wrong, which is what happened to Wisp. Lore for the flock lives in `packages/library-react/src/lib/pet/lore.ts`.

Accounts on the Pro plan upload or generate their own pets. Those sheets go through the same size check in `apps/api/src/services/pets/index.ts`, and generated ones are composed in the browser by `composePetSheet`, which transforms a single character image across the eleven rows. That path satisfies the contract by construction; it is the built-in sheets that need the discipline above.
