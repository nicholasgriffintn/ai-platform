# @ngriffin_uk/polychat-library-registry

## 0.3.0

### Minor Changes

- ece96c4: Add the provider primitives package and move every provider implementation into it. `ProviderLibrary` owns categorised bootstrapping, alias and lifecycle resolution, per-category decorators, and host error mapping, and providers receive a `ProviderRuntime` (`ProviderHost` plus a resolver for sibling providers) instead of importing host modules. Platform credential detection, user-versus-platform API key resolution, and provider fallback move there from the API. `utility-server` holds the server helpers those providers share, and the API and sandbox Workers resolve providers through the library.

## 0.2.0

### Minor Changes

- 293b1ca: Add the shared categorised registry. `CategoryRegistry` owns registration, alias resolution, and singleton or transient lifecycle caching, and reports failures as `RegistryError` so hosts map their own error wording.
