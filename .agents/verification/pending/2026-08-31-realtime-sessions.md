# Realtime is served from a provider catalogue and a new coordinator

- **Change:** Realtime provider presentation now comes from the server registry instead of a compile-time manifest in the browser, so a provider that needs a key or has an inaccessible default model shows as unready. Gemini Live sessions resume, audio ingress is hardened, and realtime proxying runs through a new `RealtimeProxyCoordinator` Durable Object.
- **Surfaces:** web, API
- **Prerequisites:** the `REALTIME_PROXY_COORDINATOR` binding and its `v3` migration tag, from the prerequisites item.
- **Risk if wrong:** realtime is the most stateful thing in the product and fails in ways static checks cannot see — sessions that never start, audio that never arrives, or a proxy that holds a connection open and bills for it.
- **Commits:** `cfb34f60` (#2155), `1cec6e37` (#2164), `56a8343d` (#2154), `fdd5585b` (#2153). See ADR 0030.

## Verify

- [ ] Open the realtime picker. Confirm configured providers show as ready and unconfigured ones show as needing setup, with no provider flashing in and then vanishing.
- [ ] Start an OpenAI realtime session. Speak, confirm you are heard, confirm you hear a reply, and end the session cleanly.
- [ ] Start a Gemini Live session, interrupt it — lock the screen, switch tab, or drop the network for a few seconds — and confirm it resumes rather than dying.
- [ ] End a session by closing the tab rather than pressing stop, and confirm it does not stay open on the provider side.
- [ ] Try to start a session on an account without the required provider key. Confirm a clear refusal rather than a hanging connection.
- [ ] Watch the API logs through the first few sessions for Durable Object errors about a missing class or migration tag.

**Stop and report if:** a session starts but no audio flows either way, or the coordinator throws on connect. Both mean the new Durable Object is wired wrongly, and rolling back is cheaper than debugging it live.
