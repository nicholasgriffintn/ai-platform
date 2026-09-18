---
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-utility-server": minor
"@ngriffin_uk/polychat-library-registry": minor
"@assistant/api": patch
"@assistant/training": patch
"@assistant/sandbox-worker": patch
---

Add the provider primitives package and move every provider implementation into it. `ProviderLibrary` owns categorised bootstrapping, alias and lifecycle resolution, per-category decorators, and host error mapping, and providers receive a `ProviderRuntime` (`ProviderHost` plus a resolver for sibling providers) instead of importing host modules. Platform credential detection, user-versus-platform API key resolution, and provider fallback move there from the API. `utility-server` holds the server helpers those providers share, and the API, sandbox and training Workers resolve providers through the library.
