import type { R2PutOptions } from "@cloudflare/workers-types";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import type { ProviderKeyStore } from "./api-keys";
import type { ProviderEnv, ProviderRequestContext, ProviderUser } from "./env";

export interface ProviderModelResolver {
  getModelConfig(
    model: string | undefined,
    env?: ProviderEnv,
    provider?: string,
    userId?: number,
  ): Promise<ModelConfigItem | undefined>;
  getModelConfigByModel(model: string, env?: ProviderEnv): Promise<ModelConfigItem | undefined>;
  getModelConfigByMatchingModel(
    matchingModel: string,
    env?: ProviderEnv,
    provider?: string,
    userId?: number,
  ): Promise<ModelConfigItem | null | undefined>;
  findModelConfig(
    model: string,
    env?: ProviderEnv,
    provider?: string,
    userId?: number,
  ): Promise<ModelConfigItem | null>;
  resolveModelConfig(
    model: string,
    env?: ProviderEnv,
    provider?: string,
    userId?: number,
  ): Promise<ModelConfigItem>;
  resolveModelProvider(options: {
    model?: string;
    provider?: string;
    defaultProvider: string;
    env?: ProviderEnv;
  }): Promise<string>;
  getAuxiliaryGuardrailsModel(
    env: ProviderEnv,
    user?: ProviderUser,
  ): Promise<{ model: string; provider: string }>;
  getAuxiliaryDecisionModel(
    env: ProviderEnv,
    user?: ProviderUser,
  ): Promise<{ model: string; provider: string } | null>;
  resolveRerankingModel(
    env: ProviderEnv,
    user?: ProviderUser,
    selection?: RerankingModelSelection,
  ): Promise<{ model: string; provider: string } | null>;
  getAuxiliarySpeechModel(
    env: ProviderEnv,
    user?: ProviderUser,
  ): Promise<{ model: string; provider: string; transcriptionProvider: string }>;
}

export interface RerankingModelSelection {
  model?: string;
  provider?: string;
}

export interface StoreOutputFileRequest {
  key: string;
  data: string | ArrayBuffer | Uint8Array;
  mimeType: string;
  filename?: string | null;
  byteSize?: number | null;
  outputId?: string;
  createdByUserId: number;
  projectId?: string | null;
  conversationId?: string | null;
  parentOutputId?: string | null;
  capabilityId: string;
  groupId?: string | null;
  kind: string;
  title: string;
  content?: unknown;
}

export interface StoredOutputFileResult {
  outputId: string;
  key: string;
  url: string;
}

export interface PrivateAssetOptions {
  allowedMimeTypes?: readonly string[];
  maxBytes?: number;
}

export interface ProviderStorage {
  uploadObject(
    key: string,
    data: string | ArrayBuffer | Uint8Array,
    options?: R2PutOptions,
  ): Promise<string>;
  storeOutputFile(input: StoreOutputFileRequest): Promise<StoredOutputFileResult>;
  downloadFile(url: string, ownerUserId?: number, assetsUrl?: string): Promise<Blob>;
  getPrivateAssetImageDataUrl(
    url: string,
    ownerUserId?: number,
    assetsUrl?: string,
  ): Promise<string | null>;
  getPrivateAssetDataUrl(
    url: string,
    userId?: number,
    assetsUrl?: string,
    options?: PrivateAssetOptions,
  ): Promise<string | null>;
}

export interface ProviderStorageFactory {
  forEnv(env: ProviderEnv): ProviderStorage | null;
  forContext(context: ProviderRequestContext): ProviderStorage | null;
}

export interface ProviderOperationMetrics {
  provider: string;
  model: string;
  settings?: Record<string, unknown>;
  userId?: number;
  completion_id?: string;
  env?: ProviderEnv;
  request?: unknown;
}

export interface ProviderMetrics {
  trackProviderOperation<T>(
    metrics: ProviderOperationMetrics,
    operation: () => Promise<T>,
  ): Promise<T>;
  trackGuardrailViolation(
    violationName: string,
    details: Record<string, unknown>,
    env?: ProviderEnv,
    userId?: number,
    completion_id?: string,
  ): void;
}

export interface RealtimeProxyGrantScope {
  model: string;
  provider: string;
  sessionId: string;
  userId: number;
}

export interface RealtimeProxyGrant {
  token: string;
  expiresAt: number;
}

export interface ProviderHost {
  models: ProviderModelResolver;
  storage: ProviderStorageFactory;
  metrics?: ProviderMetrics;
  keyStore(env: ProviderEnv): ProviderKeyStore | undefined;
  realtime?: {
    createProxyGrant(env: ProviderEnv, scope: RealtimeProxyGrantScope): Promise<RealtimeProxyGrant>;
  };
}
