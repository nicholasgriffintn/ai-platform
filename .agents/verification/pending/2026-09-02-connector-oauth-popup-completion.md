# OAuth connector popups now close themselves and tell the opener they finished

- **Change:** Two things stopped an authorised connector popup from finishing. The popup identified itself by `window.name`, which Chromium clears when a browsing context navigates cross-site — and the Composio callback leaves our origin for the provider before coming back. It is now identified by having an opener plus the `connected=1` and `connector=<id>` callback parameters instead. Separately, the app's blanket `Cross-Origin-Opener-Policy: same-origin-allow-popups` severed `window.opener` on that same return hop, because the popup arrived from a cross-origin document. The app now sends `Cross-Origin-Opener-Policy: unsafe-none` for that one callback URL — `/profile` carrying both `connected=1` and a `connector` — matching the relaxation the API already applies to its own verify redirect. Every other route keeps `same-origin-allow-popups`. The opener still verifies the message source and origin before accepting a completion.
- **Surfaces:** Web
- **Prerequisites:** none. Composio must be configured for the connector under test.
- **Risk if wrong:** the visible symptom is the one this fixes — an authorised connector leaves an orphaned popup open and the Providers screen still shows it disconnected until a manual refresh. The security-shaped risk runs the other way: if the COOP relaxation matched more broadly than the callback, ordinary app pages would lose their cross-origin isolation. A unit test pins the scope, but confirm the header on real responses.

## Verify

- [ ] Signed in, open Profile > Providers, filter to Connectors, and connect an OAuth connector such as Airtable. Expect the popup to close on its own, a `<connector> connected` toast in the main window, and the connector to read Connected without reloading.
- [ ] Disconnect the same connector and confirm it returns to Connected (0) — the way out still works.
- [ ] Start the same connection and close the popup by hand before authorising. Expect a `connection window was closed` error rather than a hang.
- [ ] Start the connection and leave the popup on the provider's consent screen without approving. Expect the main window to stay in its waiting state and no connector to appear.
- [ ] Confirm no ordinary Polychat tab closes itself while navigating Chat, Work, or Profile.
- [ ] `curl -sI https://<host>/chat | grep -i cross-origin-opener-policy` and the same for `https://<host>/profile?tab=providers`. Both must say `same-origin-allow-popups`.
- [ ] `curl -sI 'https://<host>/profile?tab=providers&type=connector&connector=airtable&connected=1' | grep -i cross-origin-opener-policy`. Only this one must say `unsafe-none`.

**Stop and report if:** any window other than the authorisation popup closes itself, or the main window reports a connector as connected when the provider refused the authorisation.

## Notes

The E2E journey `Connector configuration > authorises and disconnects an OAuth connector` now exercises the popup handshake against a Composio double, so the automated suite proves the message path. It cannot prove real cross-site navigation against a live provider, which is what these steps are for.
