import type { ServiceContext } from "~/lib/context/serviceContext";
import { providerLibrary } from "~/lib/providers/library";
import type { IEnv, IUser, IUserSettings, MemoryScope } from "~/types";

import { BoundMemoryProvider } from "./providers/BoundMemoryProvider";
import type { MemoryProvider, MemoryProviderId } from "./types";

export function isMemoryProviderId(value: unknown): value is MemoryProviderId {
  return (
    value === "built-in" || value === "documents" || value === "hindsight" || value === "honcho"
  );
}

export interface GetMemoryProviderContext {
  env: IEnv;
  user?: IUser;
  userSettings?: IUserSettings | null;
  serviceContext?: ServiceContext;
  memoryScope?: MemoryScope;
}

export function getMemoryProvider({
  env,
  user,
  userSettings,
  serviceContext,
  memoryScope = { type: "personal" },
}: GetMemoryProviderContext): MemoryProvider {
  if (memoryScope.type === "bound") {
    const documents = providerLibrary.memory("documents", {
      env,
      user,
      userSettings,
      serviceContext,
      memoryScope,
    });
    const baselineName: MemoryProviderId | undefined = memoryScope.baseline
      ? memoryScope.baseline.type === "project"
        ? "built-in"
        : isMemoryProviderId(userSettings?.memory_provider)
          ? userSettings.memory_provider
          : "built-in"
      : undefined;
    const baseline = baselineName
      ? providerLibrary.memory(baselineName, {
          env,
          user,
          userSettings,
          serviceContext,
          memoryScope: memoryScope.baseline,
        })
      : undefined;

    return new BoundMemoryProvider(
      documents,
      baseline,
      new Set(memoryScope.documents.map((binding) => binding.documentId)),
    );
  }

  const providerName: MemoryProviderId =
    memoryScope.type === "project"
      ? "built-in"
      : isMemoryProviderId(userSettings?.memory_provider)
        ? userSettings.memory_provider
        : "built-in";

  return providerLibrary.memory(providerName, {
    env,
    user,
    userSettings,
    serviceContext,
    memoryScope,
  });
}
