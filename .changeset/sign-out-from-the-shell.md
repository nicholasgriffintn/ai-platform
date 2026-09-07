---
"@assistant/app": minor
"@assistant/desktop": minor
"@ngriffin_uk/polychat-component-navigation": minor
"@ngriffin_uk/polychat-component-shell": major
---

Let anyone sign out from the shell, and let the desktop window sign out at all.

The desktop application had a `sign_out` command in Rust that nothing ever called. A signed-in window held its session in the operating system keychain with no way to give it back, so the only way off an account was to delete the credential by hand. On the web, signing out was buried in the profile page.

The sidebar settings popover now carries a sign-out entry beside the account links, and `ShellHost` gains a required `signOut` so each host does what signing out means for it: the web ends the session through the API, and the desktop ends it through the API _and_ forgets the keychain entry, so a window that cannot reach the API still stops holding the credential.
