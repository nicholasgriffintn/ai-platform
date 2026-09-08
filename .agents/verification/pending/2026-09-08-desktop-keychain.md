# Desktop sign-in survives relaunch without repeated Keychain prompts

- **Change:** use a stable development signing identity and a fresh authenticated-session credential slot. Cache credential reads during a process lifetime; diagnostics do not read credentials.
- **Surfaces:** macOS desktop startup and sign-in.
- **Prerequisites:** rebuild the desktop app and sign in once through the browser. The old credential remains untouched and is not migrated automatically.
- **Automated evidence:** a disposable credential survived a signed binary rebuild and reread without prompting. This does not verify the existing user credential or the complete desktop sign-in flow.

## Verify

- [ ] Sign in through the browser, close the desktop app and reopen it; confirm sign-in survives without a repeated Keychain prompt.
- [ ] Rebuild and reopen with the same development signing identity; confirm the credential remains accessible.
- [ ] Sign out and confirm the authenticated session is removed.

**Stop and report if:** startup repeatedly prompts or silently loses the authenticated session.
