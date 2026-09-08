# The access token stops outliving the page

- **Change:** The client access token was written to `localStorage`, notionally encrypted. The key was derived from the page's own origin with a salt hard-coded in the bundle, so any script that could read the storage could also derive the key. It bought nothing against the only threat that matters here, cost a hundred thousand PBKDF2 iterations on every read and write, and fell back to writing the token in clear text whenever Web Crypto was missing or the encryption threw. The token now lives in memory for the life of the page, and any value an earlier release left in storage is deleted the first time the service is touched.
- **Surfaces:** Web app only. No API, schema or database change.
- **Prerequisites:** None.
- **Risk if wrong:** Sign-in breaking, or a session not surviving a page load.

## Why this is safe

The token is short-lived and re-mintable. `getToken` reads `/auth/token`, which authenticates on the HTTP-only session cookie, and the expiry it checks against was already held in memory. A page load therefore always re-minted the token regardless of what storage held, so the stored copy was never the thing keeping anyone signed in. Removing it narrows the window in which a script injected into the page can walk away with a bearer token, and takes nothing away from the session, which the cookie still owns.

## Verify

- [x] Sign in. Confirm you land signed in and can send a message.
- [x] Reload the page. Confirm you are still signed in and the network tab shows a fresh `/auth/token` call.
- [x] Open developer tools and confirm `localStorage` holds neither `api_key` nor `encrypted_api_key`, before and after signing in.
- [x] Sign in on a browser that already had one of those keys stored from an earlier release. Confirm both are gone after the first page load.
- [ ] Leave the tab idle past the token expiry and then send a message. Confirm the refresh happens and the message sends.
- [x] Sign out and confirm a reload leaves you signed out.
- [x] Open a second tab while signed in. Confirm it signs itself in from the cookie without the first tab doing anything.

**Stop and report if:** a reload signs you out, or either storage key reappears.

## Automated evidence — 7 September 2026

- New local Chromium `features/access-token.spec.ts` loads Chat as a Pro session and confirms neither retired storage key is present.
- It then writes both retired keys by hand, reloads, and confirms the account still resolves to Pro, a fresh `/auth/token` request is made, and both keys are gone.
- A second tab in the same context signs itself in from the session cookie alone, with no retired storage key written.
- Left open: a real sign-in journey, the idle-past-expiry refresh, and the sign-out-then-reload path.

## Automated evidence — 8 September 2026, container aaec9551

- `features/auth.spec.ts` passed registered-passkey sign-in followed by a real chat completion, and Free/Pro sign-out followed by reload and a protected account-page check. These close the sign-in and sign-out items above. Idle-past-expiry refresh remains open.
