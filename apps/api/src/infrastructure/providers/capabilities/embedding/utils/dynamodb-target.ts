import { estimateTextTokens, parseAwsCredentials } from "@ngriffin_uk/polychat-ai-providers";
import {
  type TelemetryExecutionContext,
  withEmbeddingTelemetry,
} from "@ngriffin_uk/polychat-ai-telemetry";
import { dynamoDbVectorConfigurationSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import {
  EMBEDDING_VECTOR_SPACE_VERSION,
  WORKERS_EMBEDDING_MODEL,
  WORKERS_EMBEDDING_PROVIDER,
} from "~/config/storage";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { EmbeddingProviderTarget, IEnv, IUser, IUserSettings } from "~/types";

import { providerLibrary } from "../../../library";
import type { DynamoDbVectorsEmbeddingProviderConfig } from "../providers/DynamoDbVectorsEmbeddingProvider";
import { getEmbeddingCredentialFingerprint } from "./scope";

const recordedTargetSchema = dynamoDbVectorConfigurationSchema.extend({
  credentialFingerprint: z.string().regex(/^credential_v1_[a-f0-9]{32}$/),
});

export function parseDynamoDbVectorSettings(env: IEnv, settings?: IUserSettings) {
  const parsed = dynamoDbVectorConfigurationSchema.safeParse({
    tableName: settings?.dynamodb_vectors_table_name,
    indexName: settings?.dynamodb_vectors_index_name,
    region: settings?.dynamodb_vectors_region || env.AWS_REGION || "us-east-1",
  });

  if (!parsed.success) {
    throw new AssistantError(
      "DynamoDB Vectors requires a table, vector index and region",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return parsed.data;
}

export async function resolveDynamoDbVectorTarget(
  env: IEnv,
  user: IUser,
  settings: IUserSettings,
): Promise<EmbeddingProviderTarget> {
  const config = parseDynamoDbVectorSettings(env, settings);
  const apiKey = await new UserSettingsRepository(env).getProviderApiKey(
    user.id,
    "dynamodb-vectors",
  );

  if (!apiKey) {
    throw new AssistantError(
      "DynamoDB Vectors credentials are not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  parseAwsCredentials(apiKey);
  const target = {
    ...config,
    credentialFingerprint: await getEmbeddingCredentialFingerprint(
      env.EMBEDDING_SCOPE_SECRET,
      apiKey,
    ),
  };

  return {
    provider: "dynamodb-vectors",
    target: JSON.stringify(target),
    model: WORKERS_EMBEDDING_MODEL,
    vectorSpace: target.indexName,
    vectorSpaceVersion: EMBEDDING_VECTOR_SPACE_VERSION,
  };
}

function createDynamoDbVectorProvider(
  env: IEnv,
  user: IUser,
  settings: IUserSettings | undefined,
  config: DynamoDbVectorsEmbeddingProviderConfig,
  executionCtx?: TelemetryExecutionContext,
) {
  return withEmbeddingTelemetry(
    providerLibrary.resolve("embedding", "dynamodb-vectors", { env, user, config }),
    {
      env,
      executionCtx,
      identity: { user, userTrackingEnabled: settings?.tracking_enabled },
      provider: WORKERS_EMBEDDING_PROVIDER,
      model: WORKERS_EMBEDDING_MODEL,
      estimateInputTokens: estimateTextTokens,
    },
  );
}

export function parseRecordedDynamoDbVectorTarget(target: EmbeddingProviderTarget) {
  let decoded: unknown;

  try {
    decoded = JSON.parse(target.target);
  } catch {
    throw new AssistantError(
      "Stored DynamoDB Vectors target is invalid",
      ErrorType.CONFIGURATION_ERROR,
      500,
    );
  }

  const parsed = recordedTargetSchema.safeParse(decoded);

  if (
    !parsed.success ||
    target.model !== WORKERS_EMBEDDING_MODEL ||
    target.vectorSpace !== parsed.data.indexName ||
    target.vectorSpaceVersion !== EMBEDDING_VECTOR_SPACE_VERSION
  ) {
    throw new AssistantError(
      "Stored DynamoDB Vectors provenance is inconsistent",
      ErrorType.CONFIGURATION_ERROR,
      500,
    );
  }

  return parsed.data;
}

export function getDynamoDbVectorProviderForTarget(
  env: IEnv,
  user: IUser,
  settings: IUserSettings,
  target: EmbeddingProviderTarget,
  executionCtx?: TelemetryExecutionContext,
) {
  const { credentialFingerprint, ...config } = parseRecordedDynamoDbVectorTarget(target);

  return createDynamoDbVectorProvider(
    env,
    user,
    settings,
    { ...config, ai: env.AI, expectedCredentialFingerprint: credentialFingerprint },
    executionCtx,
  );
}

export function getDynamoDbVectorProvider(
  env: IEnv,
  user?: IUser,
  settings?: IUserSettings,
  executionCtx?: TelemetryExecutionContext,
) {
  if (!user) {
    throw new AssistantError(
      "DynamoDB Vectors requires an authenticated user",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return createDynamoDbVectorProvider(
    env,
    user,
    settings,
    { ...parseDynamoDbVectorSettings(env, settings), ai: env.AI },
    executionCtx,
  );
}
