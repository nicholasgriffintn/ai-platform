# The desktop window serves every page the web application does

- **Change:** the connected Work containers, the conversation home, Profile, Models, Apps, Discover, Pets, Pricing and the legal pages moved from `apps/app` into `packages/component-shell`, and the desktop registers a page for each of them. The desktop also gained the shared Ask Poly and project-picker dialogs, an error boundary, `polychat://` links into Work and Profile, and a window title that names the open place. House fonts and built-in pet sheets now resolve through each host's bundler instead of a static `/fonts` and `/pets` directory.
- **Surfaces:** desktop and web.
- **Prerequisites:** none. The desktop capability set gained `core:window:allow-set-title`, which ships with the bundle.
- **Risk if wrong:** a sidebar link opens a 404 in the desktop window; Work loads without workspace context and shows an access refusal; the shared dialogs never open; fonts fall back to the system stack or pet sprites render as broken images in either host.
- **Commits:** None yet.

## Verify

- [ ] In the desktop window, switch to Work from the mode toggle. Confirm the workspace list loads, then open a workspace, a project, its conversation, Tasks, a task, Files, Activity, Teammates and Settings, and confirm each renders with the Work sidebar and the project's colour rather than a 404.
- [ ] Still in the desktop window, press New conversation while Work is open with no project selected. Confirm the project picker dialog appears and starting a conversation lands in that project.
- [ ] Open the Ask Poly button in the sidebar footer on desktop. Confirm Poly opens over the current page and answers, then closes.
- [ ] Open every Discover sidebar link on desktop — Tour, Models, Capabilities, Pets, Pricing — and the settings popover links to Profile, Terms and Privacy. Confirm each opens in the window rather than a 404.
- [ ] On the desktop Pets page and in Profile → Pets, confirm each built-in pet renders its animated sprite rather than a broken image. Repeat on the web Pets page.
- [ ] Load each host with the network panel open. Confirm the house fonts load from the application's own asset URLs with no request to a font host, and that headings render in the serif display face.
- [ ] Confirm the desktop window title changes as you navigate — "Chat — Polychat", "Work — Polychat", "Tasks — Polychat" — in the title bar and in the operating system's window list.
- [ ] With the desktop window open, follow `polychat://work/<workspace>/projects/<project>/tasks/<task>` and confirm it opens that task. Follow `polychat://profile?tab=billing` and confirm Billing opens.
- [ ] Confirm `polychat://pricing` and `polychat://s/<share id>` are still ignored rather than navigating the window.
- [ ] On the web, open the home route, `/chat`, a project conversation, Profile, Models, Pricing, Terms and Privacy and confirm each behaves as it did before the move, including the guest tour beneath the welcome screen.

**Stop and report if:** any sidebar or settings link answers 404 in the desktop window, a Work page loads without its sidebar or project context, a pet sprite or house font fails to load in either host, or a `polychat://` link navigates outside Chat, Work and Profile.
