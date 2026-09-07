# Signing out works from the sidebar in both hosts

- **Change:** the sidebar settings popover carries a sign-out entry, and `ShellHost` requires each host to supply what signing out means for it.
- **Surfaces:** web, desktop.
- **Prerequisites:** none.
- **Risk if wrong:** a desktop window keeps a session in the operating system keychain after the account believes it signed out.

## Verify

- [ ] On the web, sign out from the sidebar settings popover and confirm the shell returns to the signed-out state and a reload does not restore the session.
- [ ] In the desktop window, sign out from the same place and confirm it returns to the welcome screen.
- [ ] Restart the desktop application and confirm it still asks you to sign in rather than resuming the previous account.
- [ ] Take the desktop machine offline, sign out, and confirm it still returns to the welcome screen and still asks to sign in after a restart.
- [ ] Sign back in on the desktop and confirm conversations, Files and Teammates all load for the newly signed-in account.

**Stop and report if:** after signing out, the desktop keychain still holds a Polychat session, or signing in as a second account shows the first account's conversations.
