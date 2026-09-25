import {
  trainingProviderSchema,
  getTrainingDeploymentChatModelId,
  parseTrainingDeploymentChatModelId,
  trainingDeploymentTargetSchema,
  type TrainingDeploymentTarget,
  type TrainingProviderId,
  type ModelConfig,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import { hasD1DatabaseBinding, type EnvWithD1Database } from "~/infrastructure/database/bindings";
import type { IEnv } from "~/types";

interface TrainingDeploymentRow {
  provider: string;
  endpoint_name: string;
  deployment_name: string;
  model_name: string;
  endpoint_config_name: string;
  user_id: number | null;
  status: string;
  model_id: string;
  model_artifacts_s3_uri: string | null;
  failure_reason: string | null;
  request_json: string | null;
  response_json: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TrainingDeploymentRuntimeRecord {
  provider: TrainingProviderId;
  endpointName: string;
  deploymentName: string;
  status: string;
  modelId: string;
  deploymentTarget?: TrainingDeploymentTarget;
  importedModelArn?: string;
  url?: string;
}

const SAGEMAKER_READY_STATUSES = new Set(["inservice", "in service"]);
const BEDROCK_IMPORT_READY_STATUSES = new Set(["completed"]);
const HUGGINGFACE_ENDPOINT_READY_STATUSES = new Set(["inservice"]);

export async function getTrainingDeploymentModelConfigs(
  env: IEnv | undefined,
  userId?: number,
): Promise<ModelConfig> {
  if (!hasD1DatabaseBinding(env) || !userId) {
    return {};
  }

  const records = await listTrainingDeploymentRuntimeRecords(env, userId);

  return records.reduce<ModelConfig>((acc, record) => {
    const config = getTrainingDeploymentModelConfig(record);

    if (config) {
      acc[
        getTrainingDeploymentChatModelId({
          provider: record.provider,
          endpointName: record.endpointName,
        })
      ] = config;
    }

    return acc;
  }, {});
}

export async function findTrainingDeploymentModelConfig(
  model: string,
  env: IEnv | undefined,
  userId?: number,
  provider?: string,
): Promise<ModelConfigItem | null> {
  if (!hasD1DatabaseBinding(env) || !userId) {
    return null;
  }

  const parsed = parseTrainingDeploymentChatModelId(model);

  if (!parsed) {
    const configs = await getTrainingDeploymentModelConfigs(env, userId);

    return (
      Object.values(configs).find(
        (config) => config.matchingModel === model && (!provider || config.provider === provider),
      ) ?? null
    );
  }

  const record =
    (await getTrainingDeploymentRuntimeRecord(env, userId, parsed.provider, parsed.endpointName)) ??
    (await getWorkspaceRoutedDeploymentRecord(env, userId, model, parsed));
  const config = record ? getTrainingDeploymentModelConfig(record) : null;

  if (!config) {
    return null;
  }

  if (provider && config.provider !== provider) {
    return null;
  }

  return config;
}

export async function getSageMakerTrainingDeploymentRuntimeRecordByEndpointName(
  env: IEnv,
  userId: number,
  endpointName: string,
): Promise<TrainingDeploymentRuntimeRecord | null> {
  if (!hasD1DatabaseBinding(env)) {
    return null;
  }

  return getTrainingDeploymentRuntimeRecord(env, userId, "aws-sagemaker", endpointName);
}

export async function getHuggingFaceEndpointRuntimeRecord(
  env: IEnv,
  endpointName: string,
): Promise<TrainingDeploymentRuntimeRecord | null> {
  if (!hasD1DatabaseBinding(env)) {
    return null;
  }

  const row = await env.DB.prepare(
    `SELECT * FROM training_deployments WHERE provider = 'huggingface' AND endpoint_name = ?`,
  )
    .bind(endpointName)
    .first<TrainingDeploymentRow>();

  return row ? mapTrainingDeploymentRuntimeRecord(row) : null;
}

async function getWorkspaceRoutedDeploymentRecord(
  env: EnvWithD1Database,
  userId: number,
  chatModelId: string,
  parsed: { provider: TrainingProviderId; endpointName: string },
): Promise<TrainingDeploymentRuntimeRecord | null> {
  const route = await env.DB.prepare(
    `SELECT model_route.id FROM model_route
		JOIN workspace_member ON workspace_member.workspace_id = model_route.workspace_id
		WHERE model_route.provider_model_id = ? AND model_route.status = 'active'
		  AND workspace_member.user_id = ?
		LIMIT 1`,
  )
    .bind(chatModelId, userId)
    .first<{ id: string }>();

  if (!route) {
    return null;
  }

  const row = await env.DB.prepare(
    `SELECT * FROM training_deployments WHERE provider = ? AND endpoint_name = ?`,
  )
    .bind(parsed.provider, parsed.endpointName)
    .first<TrainingDeploymentRow>();

  return row ? mapTrainingDeploymentRuntimeRecord(row) : null;
}

async function listTrainingDeploymentRuntimeRecords(
  env: EnvWithD1Database,
  userId: number,
): Promise<TrainingDeploymentRuntimeRecord[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM training_deployments
		WHERE user_id = ?
		ORDER BY updated_at DESC
		LIMIT 100`,
  )
    .bind(userId)
    .all<TrainingDeploymentRow>();

  return (result.results ?? []).map(mapTrainingDeploymentRuntimeRecord);
}

async function getTrainingDeploymentRuntimeRecord(
  env: EnvWithD1Database,
  userId: number,
  provider: TrainingProviderId,
  endpointName: string,
): Promise<TrainingDeploymentRuntimeRecord | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM training_deployments
		WHERE provider = ? AND endpoint_name = ? AND user_id = ?`,
  )
    .bind(provider, endpointName, userId)
    .first<TrainingDeploymentRow>();

  return row ? mapTrainingDeploymentRuntimeRecord(row) : null;
}

function mapTrainingDeploymentRuntimeRecord(
  row: TrainingDeploymentRow,
): TrainingDeploymentRuntimeRecord {
  const provider = trainingProviderSchema.parse(row.provider);
  const request = parseJsonRecord(row.request_json);
  const response = parseJsonRecord(row.response_json);

  return {
    provider,
    endpointName: row.endpoint_name,
    deploymentName: row.deployment_name,
    status: row.status,
    modelId: row.model_id,
    deploymentTarget: parseDeploymentTarget(request),
    importedModelArn: parseImportedModelArn(response),
    url: parseEndpointUrl(response),
  };
}

function getTrainingDeploymentModelConfig(
  record: TrainingDeploymentRuntimeRecord,
): ModelConfigItem | null {
  const modelId = getTrainingDeploymentChatModelId({
    provider: record.provider,
    endpointName: record.endpointName,
  });
  const normalisedStatus = record.status.toLowerCase();

  if (record.provider === "aws-sagemaker") {
    if (!SAGEMAKER_READY_STATUSES.has(normalisedStatus)) {
      return null;
    }

    return {
      matchingModel: record.endpointName,
      name: record.deploymentName,
      description: `Training deployment for ${record.modelId}`,
      provider: "sagemaker",
      supportsStreaming: false,
      supportsTemperature: true,
      supportsTopP: true,
      modalities: { input: ["text"], output: ["text"] },
      card: modelId,
    };
  }

  if (record.provider === "huggingface") {
    if (!HUGGINGFACE_ENDPOINT_READY_STATUSES.has(normalisedStatus) || !record.url) {
      return null;
    }

    return {
      matchingModel: record.endpointName,
      name: record.deploymentName,
      description: `Hugging Face Inference Endpoint for ${record.modelId}`,
      provider: "huggingface-endpoint",
      supportsStreaming: false,
      supportsTemperature: true,
      supportsTopP: true,
      modalities: { input: ["text"], output: ["text"] },
      card: modelId,
    };
  }

  if (record.provider === "aws-bedrock") {
    if (!BEDROCK_IMPORT_READY_STATUSES.has(normalisedStatus) || !record.importedModelArn) {
      return null;
    }

    return {
      matchingModel: record.importedModelArn,
      name: record.deploymentName,
      description: `Imported Bedrock model for ${record.modelId}`,
      provider: "bedrock",
      supportsStreaming: true,
      supportsTemperature: true,
      supportsTopP: true,
      bedrockApiOperation: "converse",
      bedrockStreamingApiOperation: "converse-stream",
      modalities: { input: ["text"], output: ["text"] },
      card: modelId,
    };
  }

  return null;
}

function parseDeploymentTarget(
  value: Record<string, unknown>,
): TrainingDeploymentTarget | undefined {
  return trainingDeploymentTargetSchema.safeParse(value.deploymentTarget).data;
}

function parseImportedModelArn(value: Record<string, unknown>): string | undefined {
  const importedModelArn = value.importedModelArn || value.modelArn;

  return typeof importedModelArn === "string" && importedModelArn ? importedModelArn : undefined;
}

function parseEndpointUrl(value: Record<string, unknown>): string | undefined {
  const status = value.status;

  if (!status || typeof status !== "object" || !("url" in status)) {
    return undefined;
  }

  return typeof status.url === "string" && status.url.startsWith("https://")
    ? status.url
    : undefined;
}
