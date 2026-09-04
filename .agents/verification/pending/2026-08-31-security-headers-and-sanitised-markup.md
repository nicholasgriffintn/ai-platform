# Security headers, sanitised template markup, and stricter worker auth

- **Change:** The web app sends security headers on every response, not only on document routes. `escapeHtml` moved into `utility-core` so the API and the content renderer share one implementation, and template-rendered tool results are now parsed into an inert document, stripped of scriptable elements and attributes outside an allow-list, and attached with `replaceChildren` instead of `innerHTML`. The markdown link guard is shared with the sanitiser. Worker-to-worker auth checks in the sandbox and training workers were tightened, and an ensemble merge mismatch is now surfaced rather than swallowed.
- **Surfaces:** web, API, sandbox, training
- **Prerequisites:** none beyond the release prerequisites.
- **Risk if wrong:** a Content Security Policy that is too strict breaks the app on load; a sanitiser that is too strict strips legitimate tool output; a loosened worker check exposes an internal endpoint.
- **Commits:** `78ff6bc0` (#2132), `9ee611c0` (#2141), `ab1c50d2` (#2129)

## Verify

- [ ] Load the deployed web app and check the response headers on both a document route and an asset route. Confirm the security headers are present on both. _(The production build passes this check in the local Workers release harness; the deployed host still needs checking.)_
- [ ] Watch the browser console through a full session — sign in, chat, upload, settings. Confirm no CSP violations, blocked scripts, or missing styles.
- [ ] Run a tool whose result renders through a template — anything using the response renderer — and confirm it still displays correctly with links, tables, and images intact.
- [ ] Confirm a link in a rendered result still opens, and that a hostile-looking URL scheme is refused rather than rendered.
- [ ] Trigger a sandbox run and a training job. Confirm both still authenticate against the API.
- [ ] Call a sandbox or training worker endpoint without the shared token. Confirm it is refused.
- [ ] Run an ensemble or council response and confirm a merge mismatch is reported rather than silently returning a partial answer.

**Stop and report if:** the app fails to load behind the new headers, or any tool result renders as empty where it used to render content.
