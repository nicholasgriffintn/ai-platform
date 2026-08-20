import type { ServiceContext } from "~/lib/context/serviceContext";
import { providerLibrary } from "~/lib/providers/library";
import type { IEnv, IUser, IUserSettings, MemoryScope } from "~/types";

import type { MemoryProvider, MemoryProviderId } from "./types";

export function isMemoryProviderId(value: unknown): value is MemoryProviderId {
  return value === "built-in" || value === "hindsight" || value === "honcho";
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
  const providerName = (
    memoryScope.type === "project" ? "built-in" : userSettings?.memory_provider || "built-in"
  ) as MemoryProviderId;

  return providerLibrary.memory(providerName, {
    env,
    user,
    userSettings,
    serviceContext,
    memoryScope,
  });
}
