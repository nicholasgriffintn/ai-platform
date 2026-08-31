import {
  awsRegionSchema,
  s3VectorsBucketNameSchema,
  s3VectorsIndexNameSchema,
} from "@ngriffin_uk/polychat-schemas";

import { RepositoryManager } from "~/repositories";
import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type { EmbeddingProvider, IEnv, IUser, IUserSettings } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { providerLibrary } from "../../library";
import { parseAwsCredentials } from "../../utils/helpers";
import { EMBEDDING_VECTOR_SPACE_VERSION, WORKERS_EMBEDDING_MODEL } from "./constants";
import { getEmbeddingCredentialFingerprint } from "./utils/scope";

const S3_CREDENTIAL_FINGERPRINT_PATTERN = /^credential_v1_[a-f0-9]{32}$/;

const parseS3VectorTarget = (
  target: {
    bucketName?: unknown;
    indexName?: unknown;
    region?: unknown;
    credentialFingerprint?: unknown;
  },
  statusCode = 400,
  requireCredentialFingerprint = true,
) => {
  const parsed = {
    bucketName: s3VectorsBucketNameSchema.safeParse(target.bucketName),
    indexName: s3VectorsIndexNameSchema.safeParse(target.indexName),
    region: awsRegionSchema.safeParse(target.region),
    credentialFingerprint:
      typeof target.credentialFingerprint === "string" &&
      S3_CREDENTIAL_FINGERPRINT_PATTERN.test(target.credentialFingerprint)
        ? target.credentialFingerprint
        : null,
  };

  if (
    !parsed.bucketName.success ||
    !parsed.indexName.success ||
    !parsed.region.success ||
    (requireCredentialFingerprint && !parsed.credentialFingerprint)
  ) {
    throw new AssistantError(
      "S3 Vectors target is invalid",
      ErrorType.CONFIGURATION_ERROR,
      statusCode,
    );
  }

  return {
    bucketName: parsed.bucketName.data,
    indexName: parsed.indexName.data,
    region: parsed.region.data,
    credentialFingerprint: parsed.credentialFingerprint,
  };
};

export interface EmbeddingProviderTarget {
  provider: string;
  target: string;
  model: string;
  vectorSpace: string;
  vectorSpaceVersion: string;
}

export const isQuarantinedEmbeddingProviderTarget = (target: EmbeddingProviderTarget) =>
  target.provider === "quarantined" &&
  target.target === "quarantined-legacy" &&
  target.model === "unknown-legacy" &&
  target.vectorSpace === "legacy-unresolved" &&
  target.vectorSpaceVersion === "legacy";

export async function resolveEmbeddingProviderTarget(
  env: IEnv,
  user: IUser,
  userSettings: IUserSettings,
): Promise<EmbeddingProviderTarget> {
  const provider = userSettings.embedding_provider || "vectorize";

  if (provider === "bedrock") {
    throw new AssistantError(
      "Bedrock embedding lifecycle is not available",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  if (provider === "s3vectors") {
    if (!userSettings.s3vectors_bucket_name || !userSettings.s3vectors_index_name) {
      throw new AssistantError(
        "Missing required S3 Vectors bucket or index name",
        ErrorType.CONFIGURATION_ERROR,
        500,
      );
    }

    const apiKey = await new UserSettingsRepository(env).getProviderApiKey(user.id, "s3vectors");

    if (!apiKey) {
      throw new AssistantError(
        "S3 Vectors user credentials are not configured",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
    }

    parseAwsCredentials(apiKey);

    const target = parseS3VectorTarget({
      bucketName: userSettings.s3vectors_bucket_name,
      indexName: userSettings.s3vectors_index_name,
      region: userSettings.s3vectors_region || env.AWS_REGION || "us-east-1",
      credentialFingerprint: await getEmbeddingCredentialFingerprint(
        env.EMBEDDING_SCOPE_SECRET,
        apiKey,
      ),
    });

    return {
      provider,
      target: JSON.stringify(target),
      model: WORKERS_EMBEDDING_MODEL,
      vectorSpace: target.indexName,
      vectorSpaceVersion: EMBEDDING_VECTOR_SPACE_VERSION,
    };
  }

  if (provider === "vectorize") {
    return {
      provider,
      target: "vectorize-binding",
      model: WORKERS_EMBEDDING_MODEL,
      vectorSpace: "default",
      vectorSpaceVersion: EMBEDDING_VECTOR_SPACE_VERSION,
    };
  }

  throw new AssistantError(
    "Embedding provider does not support document lifecycle operations",
    ErrorType.CONFIGURATION_ERROR,
    503,
  );
}

export function getEmbeddingProviderForTarget(
  env: IEnv,
  user: IUser,
  userSettings: IUserSettings,
  target: EmbeddingProviderTarget,
): EmbeddingProvider {
  if (target.vectorSpaceVersion !== EMBEDDING_VECTOR_SPACE_VERSION) {
    throw new AssistantError(
      "Embedding vector space version is not supported",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  if (target.provider === "s3vectors") {
    let parsedTarget: {
      bucketName?: unknown;
      indexName?: unknown;
      region?: unknown;
      credentialFingerprint?: unknown;
    };

    try {
      parsedTarget = JSON.parse(target.target);
    } catch {
      throw new AssistantError(
        "Stored embedding provider target is invalid",
        ErrorType.CONFIGURATION_ERROR,
        500,
      );
    }

    const storedTarget = parseS3VectorTarget(parsedTarget, 500);

    if (target.model !== WORKERS_EMBEDDING_MODEL || target.vectorSpace !== storedTarget.indexName) {
      throw new AssistantError(
        "Stored S3 Vectors provenance is inconsistent",
        ErrorType.CONFIGURATION_ERROR,
        500,
      );
    }

    return providerLibrary.embedding("s3vectors", {
      env,
      user,
      config: {
        bucketName: storedTarget.bucketName,
        indexName: storedTarget.indexName,
        region: storedTarget.region,
        accessKeyId: env.S3VECTORS_AWS_ACCESS_KEY || "",
        secretAccessKey: env.S3VECTORS_AWS_SECRET_KEY || "",
        expectedCredentialFingerprint: storedTarget.credentialFingerprint,
        ai: env.AI,
      },
    });
  }

  if (
    target.provider !== "vectorize" ||
    target.target !== "vectorize-binding" ||
    target.model !== WORKERS_EMBEDDING_MODEL ||
    target.vectorSpace !== "default"
  ) {
    throw new AssistantError(
      "Stored embedding provider target is not supported",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return getEmbeddingProvider(env, user, {
    ...userSettings,
    embedding_provider: "vectorize",
  });
}

export function getEmbeddingProvider(
  env: IEnv,
  user?: IUser,
  userSettings?: IUserSettings,
): EmbeddingProvider {
  const providerName = userSettings?.embedding_provider || "vectorize";

  switch (providerName) {
    case "bedrock": {
      throw new AssistantError(
        "Bedrock embedding lifecycle is not available",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
    }

    case "s3vectors": {
      if (!userSettings?.s3vectors_bucket_name || !userSettings.s3vectors_index_name) {
        throw new AssistantError("Missing required S3 Vectors bucket or index name");
      }

      const target = parseS3VectorTarget(
        {
          bucketName: userSettings.s3vectors_bucket_name,
          indexName: userSettings.s3vectors_index_name,
          region: userSettings.s3vectors_region || env.AWS_REGION || "us-east-1",
        },
        400,
        false,
      );

      const config = {
        ...target,
        accessKeyId: env.S3VECTORS_AWS_ACCESS_KEY || "",
        secretAccessKey: env.S3VECTORS_AWS_SECRET_KEY || "",
        ai: env.AI,
      };

      return providerLibrary.embedding("s3vectors", { env, user, config });
    }

    case "vectorize": {
      if (!env.AI || !env.VECTOR_DB) {
        throw new AssistantError("Vectorize embeddings require AI and Vectorize bindings");
      }

      const repositories = new RepositoryManager(env);
      const config = {
        ai: env.AI,
        vector_db: env.VECTOR_DB,
        repositories,
      };

      return providerLibrary.embedding("vectorize", { env, user, config });
    }

    default:
      throw new AssistantError(
        "Embedding provider does not support lifecycle operations",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
  }
}
