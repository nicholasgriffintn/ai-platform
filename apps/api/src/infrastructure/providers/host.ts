import type {
  ProviderEnv,
  ProviderHost,
  ProviderRequestContext,
  ProviderUser,
} from "@ngriffin_uk/polychat-ai-providers";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { providerMetrics } from "~/infrastructure/telemetry";
import {
  findModelConfig,
  getApplyEditModel,
  getAuxiliaryDecisionModel,
  getAuxiliaryGuardrailsModel,
  getAuxiliaryModel,
  getAuxiliaryModelForRetrieval,
  getAuxiliaryRerankingModel,
  getAuxiliarySpeechModel,
  getCompactionModel,
  getDefaultChatModel,
  getFimModel,
  getImageModel,
  getModelConfig,
  getModelConfigByMatchingModel,
  getModelConfigByModel,
  getMusicModel,
  getNextEditModel,
  getOcrModel,
  getSpeechSynthesisModel,
  getSystemModel,
  getTitlingModel,
  getVideoModel,
  resolveModelConfig,
  resolveModelProvider,
  resolveRerankingModel,
} from "~/modules/models/application/resolve";
import { createRealtimeProxyGrant } from "~/modules/realtime/application/proxy-grant";
import { resolveMcpCredential } from "~/modules/tools/application/mcp-connections";
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
    resolveServiceContext({
      env: asEnv(context.env),
      user: asUser(context.user),
    }),
  );
}

export const providerHost: ProviderHost = {
  mcp: {
    resolveCredential: (context, input) =>
      resolveMcpCredential(
        resolveServiceContext({ env: asEnv(context.env ?? {}), user: asUser(context.user) }),
        input,
      ),
  },
  models: {
    getModelConfig: (model, env, provider, userId) =>
      getModelConfig(model, env ? asEnv(env) : undefined, provider, userId),
    getModelConfigByModel: (model) => getModelConfigByModel(model),
    getModelConfigByMatchingModel: (matchingModel, env, provider, userId) =>
      getModelConfigByMatchingModel(matchingModel, env ? asEnv(env) : undefined, provider, userId),
    findModelConfig: (model, env, provider, userId) =>
      findModelConfig(model, env ? asEnv(env) : undefined, provider, userId),
    resolveModelConfig: (model, env, provider, userId) =>
      resolveModelConfig(model, env ? asEnv(env) : undefined, provider, userId),
    resolveModelProvider: ({ env, ...options }) =>
      resolveModelProvider({ ...options, env: env ? asEnv(env) : undefined }),
    getDefaultChatModel: (env, user) => getDefaultChatModel(asEnv(env), asUser(user)),
    getSystemModel: (env, user, role) => getSystemModel(asEnv(env), asUser(user), role as never),
    getAuxiliaryModel: (env, user) => getAuxiliaryModel(asEnv(env), asUser(user)),
    getTitlingModel: (env, user) => getTitlingModel(asEnv(env), asUser(user)),
    getCompactionModel: (env, user) => getCompactionModel(asEnv(env), asUser(user)),
    getAuxiliaryModelForRetrieval: (env, user) =>
      getAuxiliaryModelForRetrieval(asEnv(env), asUser(user)),
    getAuxiliaryGuardrailsModel: (env, user) =>
      getAuxiliaryGuardrailsModel(asEnv(env), asUser(user)),
    getAuxiliaryDecisionModel: (env, user, inputs) =>
      getAuxiliaryDecisionModel(asEnv(env), asUser(user), inputs),
    resolveRerankingModel: (env, user, selection) =>
      resolveRerankingModel(asEnv(env), asUser(user), selection),
    getAuxiliaryRerankingModel: (env, user, selection) =>
      getAuxiliaryRerankingModel(asEnv(env), asUser(user), selection),
    getAuxiliarySpeechModel: async (env, user) => {
      const apiUser = asUser(user);
      const userSettings = apiUser?.id
        ? await new UserSettingsRepository(asEnv(env)).getUserSettings(apiUser.id)
        : null;

      return getAuxiliarySpeechModel(asEnv(env), userSettings ?? undefined, apiUser);
    },
    getOcrModel: (env, user) => getOcrModel(asEnv(env), asUser(user)),
    getImageModel: (env, user) => getImageModel(asEnv(env), asUser(user)),
    getVideoModel: (env, user) => getVideoModel(asEnv(env), asUser(user)),
    getMusicModel: (env, user) => getMusicModel(asEnv(env), asUser(user)),
    getSpeechSynthesisModel: (env, user) => getSpeechSynthesisModel(asEnv(env), asUser(user)),
    getFimModel: (env, user) => getFimModel(asEnv(env), asUser(user)),
    getNextEditModel: (env, user) => getNextEditModel(asEnv(env), asUser(user)),
    getApplyEditModel: (env, user) => getApplyEditModel(asEnv(env), asUser(user)),
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
