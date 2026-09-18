import type { ProviderHost, ProviderStorage } from "../host.js";
import { createCatalogueModelResolver } from "../model-resolver.js";
import type { AiProviderResolver, ProviderRuntime } from "../runtime.js";

export function createTestStorage(overrides: Partial<ProviderStorage> = {}): ProviderStorage {
  const unsupported = (operation: string) => async () => {
    throw new Error(`${operation} is not supported by the test storage`);
  };

  return {
    uploadObject: unsupported("uploadObject"),
    storeOutputFile: unsupported("storeOutputFile"),
    downloadFile: unsupported("downloadFile"),
    getPrivateAssetImageDataUrl: unsupported("getPrivateAssetImageDataUrl"),
    getPrivateAssetDataUrl: unsupported("getPrivateAssetDataUrl"),
    ...overrides,
  };
}

export function createTestHost(overrides: Partial<ProviderHost> = {}): ProviderHost {
  return {
    models: createCatalogueModelResolver(),
    storage: { forEnv: () => null, forContext: () => null },
    keyStore: () => undefined,
    ...overrides,
  };
}

export function createTestRuntime(
  overrides: Partial<ProviderHost> = {},
  providers: AiProviderResolver = {
    resolve: () => {
      throw new Error("No providers registered in the test runtime");
    },
  },
): ProviderRuntime {
  return { host: createTestHost(overrides), providers };
}
