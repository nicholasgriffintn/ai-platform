import { AwsClient } from "aws4fetch";

import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/storage/s3Artifacts" });

export interface S3Location {
  bucket: string;
  key?: string;
  prefix?: string;
  bucketOwner?: string;
  region?: string;
}

export interface ResolveS3ArtifactOptions extends S3Location {
  client: AwsClient;
  extensions: string[];
}

export interface S3ArtifactResolution {
  url?: string;
  bucket: string;
  key?: string;
  prefix?: string;
  source: "s3";
}

const DEFAULT_REGION = "us-east-1";

export function parseS3Uri(uri?: string): S3Location | null {
  if (!uri || !uri.startsWith("s3://")) {
    return null;
  }

  const remainder = uri.slice("s3://".length);
  if (!remainder) {
    return null;
  }

  const [bucket, ...rest] = remainder.split("/");
  if (!bucket) {
    return null;
  }

  const prefix = rest.join("/");
  return { bucket, prefix };
}

async function listS3Keys({
  client,
  bucket,
  prefix,
  bucketOwner,
  region = DEFAULT_REGION,
}: {
  client: AwsClient;
  bucket: string;
  prefix?: string;
  bucketOwner?: string;
  region?: string;
}): Promise<string[] | undefined> {
  try {
    const normalizedPrefix = prefix?.replace(/^\/+/, "") ?? "";
    const searchParams = new URLSearchParams({ "list-type": "2" });

    if (normalizedPrefix) {
      searchParams.set("prefix", normalizedPrefix);
    }

    const listUrl = `https://${bucket}.s3.${region}.amazonaws.com/?${searchParams.toString()}`;
    const headers = bucketOwner
      ? { "x-amz-expected-bucket-owner": bucketOwner }
      : undefined;
    const signedRequest = await client.sign(listUrl, {
      method: "GET",
      headers,
    });

    const response = await fetch(signedRequest);

    if (!response.ok) {
      logger.error("Failed to list S3 objects", {
        bucket,
        prefix,
        status: response.status,
      });
      return undefined;
    }

    const xml = await response.text();
    return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((match) => match[1]);
  } catch (error) {
    logger.error("Failed to list S3 artifacts", {
      error,
      bucket,
      prefix,
    });
    return undefined;
  }
}

async function createPresignedUrl({
  client,
  bucket,
  key,
  bucketOwner,
  region = DEFAULT_REGION,
}: {
  client: AwsClient;
  bucket: string;
  key: string;
  bucketOwner?: string;
  region?: string;
}): Promise<string | undefined> {
  try {
    const encodedKey = encodeURIComponent(key).replace(/%2F/g, "/");
    const objectUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
    const headers = bucketOwner
      ? { "x-amz-expected-bucket-owner": bucketOwner }
      : undefined;

    const presignedRequest = await client.sign(objectUrl, {
      method: "GET",
      headers,
      aws: { signQuery: true },
    });

    return presignedRequest.url;
  } catch (error) {
    logger.error("Failed to create S3 presigned URL", {
      error,
      bucket,
      key,
    });
    return undefined;
  }
}

export async function resolveS3Artifact(
  options: ResolveS3ArtifactOptions,
): Promise<S3ArtifactResolution | undefined> {
  const { client, bucket, prefix, key, bucketOwner, extensions, region } = options;

  if (!bucket) {
    return undefined;
  }

  const resolvedKey = key
    ? key
    : await (async () => {
        const keys = await listS3Keys({
          client,
          bucket,
          prefix,
          bucketOwner,
          region,
        });
        if (!keys?.length) {
          return undefined;
        }

        return keys.find((candidate) =>
          extensions.some((ext) => candidate.toLowerCase().endsWith(ext)),
        );
      })();

  if (!resolvedKey) {
    return {
      bucket,
      prefix,
      source: "s3",
    };
  }

  const url = await createPresignedUrl({
    client,
    bucket,
    key: resolvedKey,
    region,
    bucketOwner,
  });

  return {
    bucket,
    key: resolvedKey,
    prefix,
    url,
    source: "s3",
  };
}
