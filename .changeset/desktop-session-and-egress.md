---
"@assistant/desktop": patch
"@ngriffin_uk/polychat-schemas": minor
---

Correct how the desktop window and the desktop host talk to the Polychat API.

The window renewed its access token on a blind ten minute timer against a token the API mints for fifteen minutes and stops reissuing with five minutes left. A laptop that slept through a tick woke holding a token nobody would renew, and every request failed until the next tick happened to land. The host now reports `expiresIn` alongside the token, and the window renews from that lifetime and again whenever the window regains focus or the machine comes back online.

The packaged content security policy also refused the API origin, so avatars, uploads and generated images never rendered in the packaged application even though the same markup worked on the web. `img-src`, `media-src` and `connect-src` now admit the API and the avatar hosts the account menu reads, and a test holds the packaged and development policies to that.

Other corrections:

- A run whose Rust command refused — an endpoint that is no longer configured, a runtime the egress rules will not reach — closed its event stream silently, leaving the composer waiting on a reply that never came. The bridge now reports the refusal as a failed run, and an event this version cannot parse fails the run rather than hanging it.
- Pairing secrets saved against a model runtime were stored and never sent. Probing, model discovery and model runs now carry them, as agent runs already did.
- A model or agent run could leave its identifier in the cancellation registry when the HTTP client refused to build, so a later run reusing that identifier started cancelled.
- The window now refuses to start against an API origin the host was not built for, rather than signing in against one API and calling another.

`polychat-schemas` publishes `desktopSessionTokenSchema` for the host's token reply and `isSameOrigin` alongside the other navigation guards.
