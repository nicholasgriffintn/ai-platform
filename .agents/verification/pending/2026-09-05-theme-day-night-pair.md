# System theme resolves through a chosen day and night pair

- **Change:** With System selected, the theme picker's System card carries two selects, By day (light palettes) and By night (dark palettes). The pair is stored on the device as `polychat-theme-pair`, applied before first paint, and ignored whenever an explicit theme is chosen.
- **Surfaces:** Customisation theme picker, every web page when System is selected.
- **Prerequisites:** None.
- **Risk if wrong:** A device following the operating system could paint the wrong palette at first load, the pair selects could toggle the radio behind them, or a stored pair with mismatched appearances could produce a light palette at night.
- **Commits:** None yet.

## Verify

- [ ] Open Customisation with System selected. Confirm the System card shows By day and By night selects listing only light and only dark palettes respectively, and that its preview halves update as you change them. Choose Paper by day and Fern by night, and confirm the caption reads Paper · Fern.
- [ ] Switch the operating system between light and dark. Confirm the app moves between Paper and Fern without a reload, and that a reload in each state paints the chosen palette without a flash of Light or Dark.
- [x] Choose an explicit theme such as Plum. Confirm the pair no longer affects anything when the operating system changes, then return to System and confirm the pair is remembered.
- [ ] Use the keyboard on the System card: Tab to the radio, then into each select and change a value with the arrow keys. Confirm changing a select does not change which theme option is selected.
- [x] Set `polychat-theme-pair` in local storage to `fern:paper` and reload. Confirm the app falls back to Light by day and Dark by night and the selects show that fallback.

**Stop and report if:** A reload flashes the wrong palette, a select change flips the selected radio, or a mismatched stored pair is honoured.

## Automated evidence — 5 September 2026

Local Chromium E2E: `features/themes.spec.ts`, **remembers the day and night pair across appearance changes, reloads and explicit themes**, passed in the release suite. The test also confirms appearance-filtered options, selection preservation and the resolved palette after reload. First-paint flashes, preview captions and arrow-key interaction remain unchecked.

Focused E2E: both theme journeys passed, including **rejects a stored pair with reversed appearances**, which confirms fallback controls and both resolved appearances.
