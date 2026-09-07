---
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-component-ui": minor
"@assistant/desktop": minor
"@assistant/app": patch
---

Give the desktop window every page the web application serves.

The desktop had the Chat places and nothing else. Work went nowhere, because its connected containers lived in `apps/app` where only the web could reach them, and the same was true of the conversation home, Profile, Models, Discover, Pets, Pricing and the legal pages. The mode toggle, the Discover section and the settings popover all linked to routes the window answered with a 404.

- The connected Work containers, the conversation home, Profile, Models, Discover, Pets, Pricing and the legal pages moved into `component-shell` beside the Chat places they already shared. `WorkPlaceShell` is the Work frame, reading the workspace and project from the route the way `ChatPlaceShell` reads the Chat place.
- The desktop registers a page directory for each of them, so every link either host renders now resolves in both.
- Ask Poly and the project picker moved into a shared `ShellDialogs` the desktop mounts through `ShellHostProvider`, and the desktop drops the throwing placeholder it used for Ask Poly.
- The desktop wraps its routes in the shared error page, so a render failure explains itself instead of leaving a blank window.
- `polychat://` links reach Work, Profile and Discover as well as Chat, which is what the attention notifications the window already raises point at.
- The window title names the open place rather than staying "Polychat".
- House fonts and built-in pet sheets ship inside `component-ui` and resolve through each host's bundler, replacing the static `/fonts` and `/pets` directory the desktop reached by symlink.
