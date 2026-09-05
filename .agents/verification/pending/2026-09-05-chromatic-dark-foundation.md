# Chromatic dark foundation across Chat and Work

- **Change:** Replaced neutral dark shell surfaces with the shared deep-ink palette and semantic signal colours while retaining the light theme.
- **Themes:** Light, Dark and Blue are named palettes chosen in Customisation; Dark is a much deeper version of Blue. Theme choice is device state and applies before first paint.
- **Palette:** Neutrals, interaction accent and primary action share one cool hue family; every token resolves inside sRGB so browsers no longer clip the accent, primary or failure colours.
- **Work sweep:** Every raw zinc, amber, emerald, blue, red and violet class across Work and `component-workspaces` now resolves through semantic tokens, so both themes come from one palette.
- **Surfaces:** Web application shell, navigation, conversation composer, Search, profile navigation, shared dialogs and popovers, Canvas controls, cards, menus and project headers.
- **Prerequisites:** None.
- **Risk if wrong:** Text, focus rings or active states may lose contrast, a swept Work surface may lose a background or border it relied on, or light mode may inherit dark-theme colours.
- **Commits:** None yet.

## Verify

- [ ] Open a representative Chat conversation in dark mode. Confirm the shell, sidebar, composer, cards and menus use consistent blue-indigo neutrals; primary text, muted text, focus rings and the send action remain clearly distinguishable.
- [ ] Confirm selected sidebar items and the image-mode control use icon or text emphasis without a rounded accent border or filled selection container. Confirm the Chat/Work switch, suggestions, notices and composer controls do not fall back to isolated black or zinc panels.
- [ ] Open Search, the Add menu and chat Settings. Confirm Search results and Add-menu hover use the selection tint, inactive settings tabs remain legible, and inputs use the shared surface, border and focus tokens.
- [ ] Open Profile and Canvas in dark mode. Confirm the profile sidebar is chromatic rather than black, active profile navigation uses text emphasis, Canvas inputs use shared surfaces and active Canvas modes use the creative accent instead of white or zinc markers.
- [ ] Walk the Work surfaces that were swept off the raw palette: task board and its stat cards, task detail, workspace and output cards, governance, share links and the create dialogs. Confirm nothing lost a background, border or divider, and that status tints still separate running, waiting and done.
- [ ] Confirm the project colour now shows only as a mark beside the project name, that the header carries no colour wash, and that a strongly coloured project no longer tints shared chrome.
- [ ] Open a coding-enabled project conversation and a project overview in Work. Confirm the same foundation is used, the project header tint is restrained, active navigation remains obvious and attention or streaming indicators are not confused with ordinary selection.
- [ ] Confirm the primary action reads as a solid blue fill with near-white label wherever it appears: composer send, live transport, billing badges and shared buttons.
- [ ] Confirm a streaming indicator and a selected sidebar item stay tellable apart at a glance, and that neither is mistaken for the primary action.
- [ ] Open Customisation and confirm the theme picker sits directly under Personalised responses, that each option previews in its own palette, and that System, Light, Dark and Blue each apply immediately and survive a reload without a flash of the previous theme.
- [ ] With System selected, change the operating system between light and dark and confirm the app follows without a reload.
- [ ] Open the sidebar settings popover as a guest and as a member. Confirm it carries a compact Theme select, that choosing a theme there applies immediately, and that Customisation shows the same choice.
- [ ] In each theme, check a capability grid, the model picker and a provider badge: identity accents should stay distinguishable from each other and legible against the surface.
- [ ] Check switches, range inputs, the sign-in buttons and the profile logout button in each theme; each should have a visible track, fill or background.
- [ ] In Dark, confirm the sidebar, composer and home suggestion buttons read as barely lifted from the canvas rather than as distinctly lighter panels, and that Blue still shows a clear elevation ladder.
- [ ] Confirm every selectable list uses a background rather than accent text for the current item, and shows no background on hover: chat sidebar navigation and conversations, Work navigation, the profile sidebar sections and the Sources collection list. Confirm no primary button is painted with the streaming accent.
- [ ] Switch theme on a mobile browser and confirm the browser chrome colour follows; if a theme's canvas token is ever changed, its declared `themeColor` must be changed to match.
- [ ] Repeat both screens in light mode and confirm content, menus, controls, selection and keyboard focus remain readable.
- [ ] Check the representative screens with increased browser zoom and a narrow viewport; confirm colour is not the only cue for active navigation or status.

**Stop and report if:** Any text or control is hard to distinguish, keyboard focus disappears, the project colour obscures header content, or light mode shows dark-theme surfaces.
