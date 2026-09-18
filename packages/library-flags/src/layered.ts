import { isResolved, type FlagProvider } from "./types.js";

export const LAYERED_PROVIDER_NAME = "layered";

export function createLayeredProvider(providers: readonly FlagProvider[]): FlagProvider {
  return {
    name: LAYERED_PROVIDER_NAME,
    async resolve(flagKey, defaultValue, context) {
      let last = null;

      for (const provider of providers) {
        const details = await provider.resolve(flagKey, defaultValue, context);

        if (isResolved(details)) {
          return details;
        }

        last = details;
      }

      return (
        last ?? {
          flagKey,
          value: defaultValue,
          reason: "DEFAULT",
          errorCode: "FLAG_NOT_FOUND",
          provider: LAYERED_PROVIDER_NAME,
        }
      );
    },
  };
}
