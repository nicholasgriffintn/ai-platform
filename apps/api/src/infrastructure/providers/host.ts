import type {
  ProviderEnv,
  ProviderHost,
  ProviderRequestContext,
  ProviderUser,
} from "@ngriffin_uk/polychat-ai-providers";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { StorageService } from "~/infrastructure/storage";
import { providerMetrics } from "~/infrastructure/telemetry";
import {
  findModelConfig,
  getAuxiliaryDecisionModel,
  getAuxiliaryGuardrailsModel,
  getAuxiliarySpeechModel,
  getModelConfig,
  getModelConfigByMatchingModel,
  getModelConfigByModel,
  resolveModelConfig,
  resolveModelProvider,
} from "~/modules/models/application/resolve";
import { createRealtimeProxyGrant } from "~/modules/realtime/application/proxy-grant";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IEnv, IUser } from "~/types";

function asEnv(env: ProviderEnv): IEnv {
  return env as IEnv;
}

function asUser(user: ProviderUser | undefined): IUser | undefined {
  return user as IUser | undefined;
}

function storageForEnv(env: ProviderEnv): StorageService | null {
  return env.PRIVATE_ASSETS_BUCKET ? StorageService.forPrivateAssetsEnv(asEnv(env)) : null;
}

function storageForContext(context: ProviderRequestContext): StorageService | null {
  if (!context.env?.PRIVATE_ASSETS_BUCKET) {
    return null;
  }

  return StorageService.forPrivateAssets(
    resolveServiceContext({ env: asEnv(context.env), user: asUser(context.user) }),
  );
}

export const providerHost: ProviderHost = {
  models: {
    getModelConfig: (model, env, provider, userId) =>
      getModelConfig(model, env ? asEnv(env) : undefined, provider, userId),
    getModelConfigByModel: (model, env) =>
      getModelConfigByModel(model, env ? asEnv(env) : undefined),
    getModelConfigByMatchingModel: (matchingModel, env, provider, userId) =>
      getModelConfigByMatchingModel(matchingModel, env ? asEnv(env) : undefined, provider, userId),
    findModelConfig: (model, env, provider, userId) =>
      findModelConfig(model, env ? asEnv(env) : undefined, provider, userId),
    resolveModelConfig: (model, env, provider, userId) =>
      resolveModelConfig(model, env ? asEnv(env) : undefined, provider, userId),
    resolveModelProvider: ({ env, ...options }) =>
      resolveModelProvider({ ...options, env: env ? asEnv(env) : undefined }),
    getAuxiliaryGuardrailsModel: (env, user) =>
      getAuxiliaryGuardrailsModel(asEnv(env), asUser(user)),
    getAuxiliaryDecisionModel: (env, user) => getAuxiliaryDecisionModel(asEnv(env), asUser(user)),
    getAuxiliarySpeechModel: async (env, user) => {
      const userSettings = user?.id
        ? await new RepositoryManager(asEnv(env)).userSettings.getUserSettings(user.id)
        : null;

      return getAuxiliarySpeechModel(asEnv(env), userSettings ?? undefined);
    },
  },
  storage: {
    forEnv: storageForEnv,
    forContext: storageForContext,
  },
  metrics: providerMetrics,
  keyStore: (env) => (env.DB ? new UserSettingsRepository(asEnv(env)) : undefined),
  realtime: {
    createProxyGrant: (env, scope) => createRealtimeProxyGrant(asEnv(env), scope),
  },
};
