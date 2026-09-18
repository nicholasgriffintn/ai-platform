import type {
  AiProviderMap,
  ProviderCategoryOf,
  ProviderRegistration as GenericProviderRegistration,
  ProviderRegistry as GenericProviderRegistry,
} from "@ngriffin_uk/polychat-ai-providers";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { EmbeddingProvider, IEnv, MemoryScope, IUser, IUserSettings } from "~/types";

import type { MemoryProvider } from "../capabilities/memory";
import type { MessagingProvider } from "../capabilities/messaging";
import type { SandboxProvider } from "../capabilities/sandbox";

export interface ProviderFactoryContext {
  env?: IEnv;
  user?: IUser;
  serviceContext?: ServiceContext;
  config?: unknown;
  options?: Record<string, unknown>;
  userSettings?: IUserSettings | null;
  memoryScope?: MemoryScope;
}

export type CategoryProviderMap = AiProviderMap & {
  embedding: EmbeddingProvider;
  memory: MemoryProvider;
  messaging: MessagingProvider;
  sandbox: SandboxProvider;
};

export type ProviderCategory = ProviderCategoryOf<CategoryProviderMap>;

export type ProviderRegistration<TInstance> = GenericProviderRegistration<
  TInstance,
  ProviderFactoryContext
>;

export type ProviderRegistry = GenericProviderRegistry<CategoryProviderMap, ProviderFactoryContext>;
