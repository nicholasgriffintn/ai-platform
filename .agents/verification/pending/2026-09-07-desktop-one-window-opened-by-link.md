# One desktop window, reachable by link from the rest of the machine

- **Change:** the desktop application allows only one instance and registers the `polychat://` scheme.
- **Surfaces:** desktop.
- **Prerequisites:** the scheme is registered when the bundle is installed; a build run from a development directory may not register it on every platform.
- **Risk if wrong:** two processes write the same local database, or a link from an untrusted page navigates the window somewhere it should not go.

## Verify

- [ ] Launch the installed application twice and confirm the second launch raises the first window rather than opening another.
- [ ] With the window closed, open `polychat://chat/<a conversation id>` and confirm the application starts on that conversation.
- [ ] With the window already open and minimised, open the same link and confirm the window comes forward on that conversation.
- [ ] Open `polychat://chat/files?tab=made` and confirm Files opens on the Made tab.
- [ ] Open `polychat://work/acme` and `polychat://profile` and confirm the window ignores them rather than showing an empty screen.
- [ ] Confirm the same on Windows and Linux, where the link arrives as a launch argument rather than an open-URL event.

**Stop and report if:** a `polychat://` link navigates anywhere other than a chat path, or two application processes can run at once.
