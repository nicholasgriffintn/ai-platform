import { mapJsonLines } from "@ngriffin_uk/polychat-utility-core";

import { type AwsRequester, parseS3Uri } from "../auth/aws.js";
import { misconfigured, unsupported } from "../errors.js";
import { bearer } from "../http.js";
import { HuggingFaceHubClient } from "../huggingface/hub.js";
import type { DatasetHandle, HubAccess, ModelHandle } from "../types.js";

const STAGED_EXTENSIONS = [".safetensors", ".json", ".model", ".txt", ".tiktoken", ".jinja"];

export function workingBucket(aws: AwsRequester): string {
  if (!aws.settings.bucket) {
    throw misconfigured("Add a working bucket to the AWS connection");
  }

  return aws.settings.bucket;
}

export function executionRole(aws: AwsRequester): string {
  if (!aws.settings.roleArn) {
    throw misconfigured("Add an execution role ARN to the AWS connection");
  }

  return aws.settings.roleArn;
}

export async function stageModelWeights(
  aws: AwsRequester,
  model: ModelHandle,
  hub: HubAccess | null,
  fetcher: typeof fetch,
): Promise<string> {
  if (model.weights.kind === "url") {
    return model.weights.url;
  }

  if (model.weights.kind === "provider") {
    if (model.weights.provider !== "aws" || !model.weights.ref.startsWith("s3://")) {
      throw unsupported(`${model.name} lives with another provider`);
    }

    return model.weights.ref;
  }

  const bucket = workingBucket(aws);
  const prefix = `polychat/weights/${model.versionId}/`;
  const existing = await aws.listS3Prefix(bucket, prefix);
  const client = new HuggingFaceHubClient({ token: hub?.token, fetcher });
  const reference = {
    kind: "model" as const,
    repo: model.weights.repo,
    revision: model.weights.revision,
  };
  const files = (await client.listFiles(reference)).filter((file) =>
    STAGED_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
  );

  if (!files.some((file) => file.path.endsWith(".safetensors"))) {
    throw unsupported(`${model.name} has no safetensors weights to stage`);
  }

  for (const file of files) {
    const key = `${prefix}${file.path}`;

    if (existing.some((object) => object.key === key && object.size === file.size)) {
      continue;
    }

    const response = await fetcher(client.fileUrl({ ...reference, path: file.path }), {
      headers: hub ? bearer(hub.token) : {},
    });

    if (!response.ok || !response.body) {
      throw unsupported(`Could not read ${file.path} from ${reference.repo}`);
    }

    await aws.uploadS3Stream(bucket, key, response.body, file.size);
  }

  return `s3://${bucket}/${prefix}`;
}

export async function stageDataset(
  aws: AwsRequester,
  runId: string,
  dataset: DatasetHandle,
  split: "train" | "validation",
  transform?: (record: unknown) => unknown,
): Promise<string> {
  const bucket = workingBucket(aws);
  const key = `polychat/runs/${runId}/${split}/data.jsonl`;
  const source = await dataset.file.open();

  if (transform) {
    await aws.uploadS3Stream(
      bucket,
      key,
      mapJsonLines(source, transform),
      Number.MAX_SAFE_INTEGER,
      "application/jsonl",
    );
  } else {
    await aws.uploadS3Stream(bucket, key, source, dataset.file.size, "application/jsonl");
  }

  return `s3://${bucket}/${key}`;
}

export function s3Prefix(uri: string): { bucket: string; prefix: string } {
  const { bucket, key } = parseS3Uri(uri);

  return { bucket, prefix: key };
}
