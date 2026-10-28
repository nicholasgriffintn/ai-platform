---
"@ngriffin_uk/polychat-ai-telemetry": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-library-client": minor
---

AI observability now goes to Sentry instead of PostHog. Pass a `sentry` client to `createWorkerTelemetry` and every model and embedding call is recorded as a `gen_ai` span for Sentry AI agent monitoring, with prompt and response content only for users who allow training data. Response thumbs feedback becomes Sentry user feedback tagged with the chat trace. The PostHog sink, its configuration helpers and the `usePostHogClient` hook are removed, and product analytics events continue through Beacon and Analytics Engine.
