---
"@ngriffin_uk/polychat-ai-telemetry": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-library-flags": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-schemas": minor
"@assistant/api": minor
"@assistant/app": patch
"@assistant/desktop": patch
"@assistant/mobile": patch
---

Telemetry now runs on Cloudflare Basin. Server events, metrics and AI generation signals go to a Basin Pipelines stream through the `TELEMETRY_STREAM` binding, and the admin `/metrics` endpoint reads them back with Basin SQL. The Analytics Engine and Beacon sinks are gone, along with their exports and settings.

Every row records the environment and app it came from (`api`, `web`, `desktop` or `ios`), with typed columns for identity, session, path, country, AI usage and flag exposures, and anything else under `properties`. Filter `/metrics` with `environment` and `app`.

Web, desktop and iOS send product analytics, including page and screen views, to the API in small batches, without a third-party script. The API stores them under the caller's session identity.

Flags have one interface on both sides. The API resolves Flagship and code rules through `library-flags`, and clients resolve the same assignments with `useFlag(key, defaultValue)`, backed by the new `createBootstrapProvider` and `GET /flags/bootstrap`.

```ts
const tone = useFlag("chat-tone", "control");
```
