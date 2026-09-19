# @ngriffin_uk/polychat-ai-providers

Provider primitives for Polychat backends, including every provider implementation: chat, decision, image, audio, speech, transcription, video, music, OCR, realtime, search, research, and guardrails. A host supplies a `ProviderHost` (model resolution, storage, key store, metrics) and gets a `ProviderLibrary` that bootstraps each category lazily, resolves by name or alias, handles lifecycles, and maps errors. The package does not know about Cloudflare, D1, or a specific host's error type.

```ts
import { createProviderLibrary } from "@ngriffin_uk/polychat-ai-providers";

const library = createProviderLibrary({
  host,
  bootstrappers: { chat: [registerSandboxProvider] },
  decorators: { chat: [withAvailableFunctions] },
  mapError: (error) => new HostError(error.message, error.code),
});

const openai = library.resolve("chat", "OAI", { env, user });
library.listNames("chat", { includeAliases: true });
```

`createAiProviderBootstrappers(runtime)` registers the built-in providers, and `createProviderLibrary` merges the host's own bootstrappers on top. Providers receive a `ProviderRuntime` (`host` plus a resolver for sibling providers), so a provider that needs another category asks the runtime rather than importing it.

## Host

`ProviderHost` is the inversion point. `models` resolves model configuration, `storage` creates output stores, `keyStore(env)` reads user credentials, `metrics` records provider operations, and `realtime.createProxyGrant` mints realtime proxy grants. The API implements it once in `apps/api/src/lib/providers/host.ts`.

## Library

`ProviderLibrary` runs a category's bootstrappers the first time that category is touched, and each bootstrapper at most once, so a bootstrapper added later through `registerBootstrapper` extends the category without re-registering what is already there. `list()` with no category bootstraps every category it knows about. Registrations default to `singleton`; a `transient` registration creates a new instance per resolve, which is the right choice when the instance captures request-scoped context.

`decorate` sees every resolved instance and may wrap it, which is where metering or tracing belongs. `mapError` receives each `ProviderError` the library would otherwise throw and returns the host's own error type, so callers never see the package's wording unless the host chooses it.

## Errors

Failures throw `ProviderError` with a `code`:

- `duplicate_registration`, `unknown_category`, `unknown_provider` from the registry
- `credential_required` when BYOK authority was demanded and the user holds no key
- `credential_unavailable` when a stored user key could not be read back
- `credential_missing` when the platform key is absent from the environment

## Credentials

`resolveProviderApiKey` prefers a user's stored key, read through the host's `ProviderKeyStore`, and falls back to the platform key named by `envKeyName`, unless `credentialAuthority` is `"byok"`. `isProviderPlatformEnabled` and `getPlatformEnabledProviders` answer whether the platform holds credentials for a provider id, using `PROVIDER_PLATFORM_ENV_KEYS`, where each provider lists alternative groups of environment keys that must all be present.

## Fallback

`generateWithProviderFallback` calls the requested provider and, when no model was pinned and fallback is allowed, retries once on the default provider.

## Decisions

The `decision` category wraps System One models: a `DecisionProvider` takes a `state` and a map of typed questions (`choice`, `score`, `noul`) from `@ngriffin_uk/polychat-schemas` and returns calibrated answers, never text. TypeSafe's Jev is the first implementation (`typesafe`, aliases `typesafe-ai` and `jev`), authenticated with `TYPESAFE_API_KEY` or a user's stored key; `TYPESAFE_BASE_URL` overrides the endpoint. Questions in one request are independent and run in parallel, so ask everything that might matter in one call. `ProviderHost.models.getAuxiliaryDecisionModel` tells the package whether a decision model is available for the account. The `typesafe` guardrails provider is built on it and screens with four hazard nouls plus a severity score.
