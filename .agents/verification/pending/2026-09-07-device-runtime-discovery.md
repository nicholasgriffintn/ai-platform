# Device runtime discovery is user-driven

- **Change:** Remove default Ollama and LM Studio endpoint rows and stop device discovery from refetching on window focus.
- **Surfaces:** Desktop model selection and runtime settings.
- **Prerequisites:** A desktop build, a runtime access log, and a saved device runtime for the configured-endpoint checks.
- **Risk if wrong:** A fresh install or ordinary window focus could unexpectedly contact loopback services, or an existing working runtime could disappear during migration.
- **Commits:** Not available.

## Verify

- [ ] Launch a fresh desktop install and confirm the Ollama and LM Studio access logs remain empty until a runtime is connected.
- [ ] Upgrade an install containing one never-seen seeded endpoint and one endpoint with a recorded `last_seen_at`; confirm only the working endpoint remains.
- [ ] Open the model selector, confirm saved runtime discovery occurs, then switch away from and back to the window and confirm no additional runtime probes occur.
- [ ] Save or forget a runtime and reopen the model selector; confirm the model list reflects the endpoint change.
- [ ] Sign in to a desktop with machine advertising enabled, then from a separate signed-in client confirm `GET /machines` shows the machine and model metadata without an endpoint address.
- [ ] Exit the desktop without signing out and confirm the machine becomes offline within five minutes; disable advertising or sign out and confirm the machine is removed.

**Stop and report if:** a fresh launch or window-focus change contacts a runtime without an explicit connection or selector refresh.
