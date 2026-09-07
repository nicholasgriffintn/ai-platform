# The desktop application bundles and claims its URL scheme

- **Change:** the bundle icon set gained `icon.icns` and `icon.ico`, without which the macOS bundler produced an empty application.
- **Surfaces:** desktop.
- **Prerequisites:** none.
- **Risk if wrong:** the release workflow produces an empty or icon-less application, or the `polychat://` scheme never reaches the operating system.

## Verify

- [ ] Run the desktop workflow on macOS, Windows and Linux and confirm each produces a bundle rather than failing at the icon step.
- [ ] Install the macOS build and confirm the application icon appears in Finder and the Dock rather than a generic one.
- [ ] Confirm the Windows installer and the Linux packages carry an icon too.
- [ ] Open `polychat://chat/<a conversation id>` on an installed macOS build and confirm the application takes the link.

**Stop and report if:** a bundle is produced with an empty `Contents` directory, or the operating system shows a generic icon.
