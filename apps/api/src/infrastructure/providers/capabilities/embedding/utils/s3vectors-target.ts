import {
  awsRegionSchema,
  s3VectorsBucketNameSchema,
  s3VectorsIndexNameSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

const S3_CREDENTIAL_FINGERPRINT_PATTERN = /^credential_v1_[a-f0-9]{32}$/;

export const parseS3VectorTarget = (
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
