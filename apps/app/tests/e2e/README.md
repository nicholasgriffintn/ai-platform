# Release browser checks

Keep this suite small. It checks the browser journeys that can block a release: signed-out and paid Chat, Work access, credit limits, recovery after a provider failure, and the request shape sent to representative provider APIs. Behaviour within a feature belongs in package or API tests unless it crosses a release-critical browser boundary.

`pnpm test:e2e:release` runs the release suite. `pnpm test:e2e:smoke` runs only the core browser journeys. `pnpm test:e2e:visual` captures the smoke journeys at desktop and mobile sizes in light and dark themes when the visual service is configured. CI requires visual credentials for the release run, so missing credentials cannot silently skip visual comparisons.

The provider contract checks cover OpenAI-compatible Chat, OpenAI Responses, Anthropic Messages, Cohere v2 Chat, Google native image input, OpenAI audio input, and Replicate image and video predictions. When a provider schema or modality changes, extend the closest contract at the outgoing provider boundary. Add a browser case only when a distinct request shape or user-visible modality is otherwise unprotected; providers sharing a schema do not each need a browser case.
