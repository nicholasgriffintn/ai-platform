import {
  AwsRequester,
  parseS3Uri,
  readAwsSettings,
} from "@ngriffin_uk/polychat-ai-model-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { PENDING, type PollOutcome } from "@ngriffin_uk/polychat-ai-workflows";
import {
  assignSplit,
  canonicaliseRow,
  canonicalText,
  DatasetProfiler,
  dedupeKey,
  estimateTokens,
  isPermissiveLicence,
  overlapsAny,
  redactRow,
  rowFlags,
  suggestMapping,
  wordNgrams,
} from "@ngriffin_uk/polychat-library-model-registry";
import {
  createDatasetRequestSchema,
  type DatasetSplit,
  type DatasetStats,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import {
  fetchFollowingSafeRedirects,
  parsePublicHttpUrl,
} from "@ngriffin_uk/polychat-utility-server/http";
import type { z } from "zod/v4";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  resolveProviderContext,
  workspaceHubClient,
} from "~/modules/model-governance/application/connections";
import { syncVersionReviews } from "~/modules/model-registry/application/decisions";
import { loadRegistryScope, routeStanding } from "~/modules/model-registry/application/scope";
import { ArtefactStore, artefactKeys } from "~/modules/model-registry/infrastructure/ArtefactStore";
import type { AddEvidenceInput } from "~/modules/model-registry/infrastructure/ModelGovernanceRepository";
import { completeWorkspaceRoute } from "~/modules/model-serving/application/route-completion";
import type { IEnv } from "~/types";

import type { ModelDatasetProfileRecord } from "../infrastructure/ModelDatasetRepository";
import { MAX_FLAGGED_INDEXES, MAX_TRAINING_TOKENS } from "./limits";
import { formatFromPath, httpAsyncBuffer, parquetRows, r2AsyncBuffer, streamRows } from "./sources";

const logger = getLogger({ prefix: "modules/model-datasets/pipeline" });

const HARD_ROW_LIMIT = 500_000;
const SYNTHETIC_BATCH = 20;
const DECONTAMINATION_GRAM = 13;

export const RESTRICTED_TEACHER_PROVIDERS = new Set([
  "openai",
  "anthropic",
  "google-ai-studio",
  "google-vertex",
  "grok",
  "xai",
  "perplexity-ai",
  "bedrock",
]);

type ParsedRequest = z.infer<typeof createDatasetRequestSchema>;

function parseRequest(profile: ModelDatasetProfileRecord): ParsedRequest {
  return createDatasetRequestSchema.parse(profile.request);
}

async function* uploadRows(
  env: IEnv,
  repositories: RepositoryManager,
  workspaceId: string,
  uploadId: string,
  limit: number,
): AsyncGenerator<Record<string, unknown>> {
  const upload = await repositories.modelUploads.get(workspaceId, uploadId);

  if (!upload || upload.status !== "ready") {
    throw new Error("The upload is not ready");
  }

  const store = new ArtefactStore(env);

  for (const file of upload.files) {
    const format = formatFromPath(file.path);

    if (format === "parquet") {
      yield* parquetRows(r2AsyncBuffer(env.PRIVATE_ASSETS_BUCKET, file.key, file.size), limit);
      continue;
    }

    const object = await store.get(file.key);

    if (!object) {
      throw new Error(`${file.path} is missing from storage`);
    }

    yield* streamRows(format, object.body, file.size);
  }
}

async function* hubRows(
  repositories: RepositoryManager,
  workspaceId: string,
  request: Extract<ParsedRequest, { source: "hub" }>,
  revision: string,
  limit: number,
): AsyncGenerator<Record<string, unknown>> {
  const hub = await workspaceHubClient(repositories, workspaceId);
  const token = (await repositories.modelConnections.getSecrets(workspaceId, "huggingface")).token;
  const urls = await hub.listParquetFiles({
    repo: request.repo,
    revision,
    config: request.config,
    split: request.hubSplit,
  });
  let remaining = limit;

  for (const url of urls) {
    const parsed = parsePublicHttpUrl(url);

    if (parsed.protocol !== "https:") {
      throw new Error("Dataset files must use HTTPS");
    }

    const headers: Record<string, string> =
      token && parsed.origin === "https://huggingface.co"
        ? { Authorization: `Bearer ${token}` }
        : {};
    const head = await fetchFollowingSafeRedirects(url, { method: "HEAD", headers });
    const length = Number(head.headers.get("content-length"));

    if (!head.ok || !Number.isSafeInteger(length) || length <= 0) {
      throw new Error(`Could not size ${url}`);
    }

    for await (const row of parquetRows(
      httpAsyncBuffer(url, length, headers, fetchFollowingSafeRedirects),
      remaining,
    )) {
      remaining -= 1;
      yield row;
    }

    if (remaining <= 0) {
      return;
    }
  }
}

async function* bucketRows(
  repositories: RepositoryManager,
  workspaceId: string,
  uri: string,
  limit: number,
): AsyncGenerator<Record<string, unknown>> {
  const context = await resolveProviderContext(repositories, workspaceId, "aws");
  const aws = new AwsRequester(readAwsSettings(context.credentials), context.fetcher);
  const { bucket, key } = parseS3Uri(uri);
  const format = formatFromPath(key);

  if (format === "parquet") {
    const listing = await aws.listS3Prefix(bucket, key);
    const size = listing.find((object) => object.key === key)?.size ?? 0;

    yield* parquetRows(
      {
        byteLength: size,
        async slice(start: number, end?: number) {
          const response = await aws.signed(
            "s3",
            `https://${bucket}.s3.${aws.settings.region}.amazonaws.com/${key.split("/").map(encodeURIComponent).join("/")}`,
            { method: "GET", headers: { range: `bytes=${start}-${(end ?? size) - 1}` } },
          );

          return response.arrayBuffer();
        },
      },
      limit,
    );

    return;
  }

  const response = await aws.openS3Object(bucket, key);

  if (!response.body) {
    throw new Error(`${uri} is empty`);
  }

  yield* streamRows(format, response.body, Number(response.headers.get("content-length") ?? 0));
}

async function* conversationRows(
  repositories: RepositoryManager,
  workspaceId: string,
  request: Extract<ParsedRequest, { source: "conversations" }>,
): AsyncGenerator<Record<string, unknown>> {
  const examples = await repositories.trainingExamples.listForWorkspace({
    workspaceId,
    projectId: request.projectId,
    minFeedbackRating: request.filters.minFeedbackRating,
    minQualityScore: request.filters.minQualityScore,
    since: request.filters.since,
    limit: request.filters.limit,
  });

  if (request.mapping.shape === "preference") {
    const byPrompt = new Map<string, typeof examples>();

    for (const example of examples) {
      const key = `${example.conversation_id}\u0000${example.user_prompt}`;

      byPrompt.set(key, [...(byPrompt.get(key) ?? []), example]);
    }

    for (const group of byPrompt.values()) {
      const rated = group.filter((example) => example.feedback_rating !== null);
      const best = [...rated].sort(
        (left, right) => (right.feedback_rating ?? 0) - (left.feedback_rating ?? 0),
      )[0];
      const worst = [...rated].sort(
        (left, right) => (left.feedback_rating ?? 0) - (right.feedback_rating ?? 0),
      )[0];

      if (
        best &&
        worst &&
        best.id !== worst.id &&
        (best.feedback_rating ?? 0) >= 4 &&
        (worst.feedback_rating ?? 0) <= 2
      ) {
        yield {
          system: best.system_prompt ?? "",
          prompt: best.user_prompt,
          chosen: best.assistant_response,
          rejected: worst.assistant_response,
        };
      }
    }

    return;
  }

  for (const example of examples) {
    if (
      request.filters.minFeedbackRating !== null &&
      (example.feedback_rating ?? 0) < request.filters.minFeedbackRating
    ) {
      continue;
    }

    yield {
      system: example.system_prompt ?? "",
      prompt: example.user_prompt,
      response: example.assistant_response,
    };
  }
}

async function* stagingRows(
  env: IEnv,
  workspaceId: string,
  versionId: string,
): AsyncGenerator<Record<string, unknown>> {
  const store = new ArtefactStore(env);

  for (const object of await store.list(
    artefactKeys.datasetStagingPrefix(workspaceId, versionId),
  )) {
    const body = await store.get(object.key);

    if (body) {
      yield* streamRows("jsonl", body.body, object.size);
    }
  }
}

async function generateSyntheticBatch(
  env: IEnv,
  repositories: RepositoryManager,
  profile: ModelDatasetProfileRecord,
  request: Extract<ParsedRequest, { source: "synthetic" }>,
  stats: DatasetStats,
): Promise<boolean> {
  const route = await repositories.modelRoutes.getRoute(
    profile.workspace_id,
    request.teacher.routeId,
  );

  if (!route || route.status !== "active") {
    throw new Error("The teacher route is no longer active");
  }

  const scope = await loadRegistryScope(repositories, profile.workspace_id, request.projectId, {
    versionIds: [route.version_id],
  });

  if (!routeStanding(scope, route)?.usable) {
    throw new Error("The teacher route is no longer approved for this scope");
  }

  const generated = stats.generated ?? 0;
  const total = request.teacher.sampleCount;
  const batch = Math.min(SYNTHETIC_BATCH, total - generated);
  const store = new ArtefactStore(env);
  const writer = store.writer(
    artefactKeys.datasetStaging(
      profile.workspace_id,
      profile.version_id,
      Math.floor(generated / SYNTHETIC_BATCH),
    ),
  );

  for (let index = 0; index < batch; index += 1) {
    const seed = request.seedPrompts[(generated + index) % request.seedPrompts.length];

    try {
      const completion = await completeWorkspaceRoute(
        env,
        repositories,
        route,
        seed,
        request.instructions,
      );

      await writer.writeLine({
        system: request.instructions,
        prompt: seed,
        response: completion,
      });
    } catch (error) {
      logger.warn("Synthetic generation failed for one prompt", {
        versionId: profile.version_id,
        error: getErrorMessage(error, "unknown"),
      });
    }
  }

  await writer.close();
  stats.generated = generated + batch;
  await repositories.modelDatasets.update(profile.version_id, { stats });

  return stats.generated < total;
}

async function protectedGrams(
  repositories: RepositoryManager,
  workspaceId: string,
  suiteIds: string[],
) {
  const grams = new Set<string>();

  for (const suiteId of suiteIds) {
    const suite = await repositories.modelEvals.getSuite(workspaceId, suiteId);

    for (const item of suite?.cases ?? []) {
      for (const gram of wordNgrams(`${item.input} ${item.expected ?? ""}`, DECONTAMINATION_GRAM)) {
        grams.add(gram);
      }
    }
  }

  return grams;
}

function licenceStatus(licence: string) {
  return licence === "internal" || isPermissiveLicence(licence)
    ? "pass"
    : licence === "unknown"
      ? "unknown"
      : "warn";
}

export async function processDataset(
  env: IEnv,
  repositories: RepositoryManager,
  versionId: string,
): Promise<PollOutcome> {
  const profile = await repositories.modelDatasets.get(versionId);
  const version = profile ? await repositories.modelAssets.getVersionById(versionId) : null;

  if (!profile || !version || profile.status !== "processing") {
    return { status: "success", message: "Nothing to process" };
  }

  const stats: DatasetStats = { ...profile.stats };

  try {
    const request = parseRequest(profile);

    if (request.source === "synthetic" && (stats.generated ?? 0) < request.teacher.sampleCount) {
      const more = await generateSyntheticBatch(env, repositories, profile, request, stats);

      if (more) {
        return PENDING;
      }
    }

    const limit = Math.min(request.processing.maxRows ?? HARD_ROW_LIMIT, HARD_ROW_LIMIT);
    const rows =
      request.source === "upload"
        ? uploadRows(env, repositories, profile.workspace_id, request.uploadId, limit)
        : request.source === "hub"
          ? hubRows(
              repositories,
              profile.workspace_id,
              request,
              stats.sourceRevision ?? "main",
              limit,
            )
          : request.source === "bucket"
            ? bucketRows(repositories, profile.workspace_id, request.uri, limit)
            : request.source === "conversations"
              ? conversationRows(repositories, profile.workspace_id, request)
              : stagingRows(env, profile.workspace_id, versionId);
    const store = new ArtefactStore(env);
    const writers = {
      train: store.writer(artefactKeys.datasetSplit(profile.workspace_id, versionId, "train")),
      validation: store.writer(
        artefactKeys.datasetSplit(profile.workspace_id, versionId, "validation"),
      ),
      test: store.writer(artefactKeys.datasetSplit(profile.workspace_id, versionId, "test")),
    };
    const counts: Record<DatasetSplit, number> = { train: 0, validation: 0, test: 0 };
    const flaggedIndexes: Record<DatasetSplit, number[]> = { train: [], validation: [], test: [] };
    const profiler = new DatasetProfiler();
    const seen = new Set<string>();
    const grams = await protectedGrams(
      repositories,
      profile.workspace_id,
      request.processing.decontaminateSuiteIds,
    );
    let chain = "";
    let accepted = 0;
    let mapping = request.mapping;

    for await (const raw of rows) {
      if (accepted >= limit) {
        break;
      }

      if ("__invalid" in raw) {
        profiler.invalidRows += 1;
        continue;
      }

      if (Object.keys(mapping.columns).length === 0) {
        mapping = suggestMapping(Object.keys(raw));
      }

      const result = canonicaliseRow(raw, mapping);

      if ("error" in result) {
        profiler.invalidRows += 1;
        continue;
      }

      const text = canonicalText(result.row);
      const rowHash = await sha256Hex(dedupeKey(text));

      if (request.processing.dedupe && seen.has(rowHash.slice(0, 20))) {
        profiler.duplicatesRemoved += 1;
        continue;
      }

      seen.add(rowHash.slice(0, 20));

      if (overlapsAny(text, grams, DECONTAMINATION_GRAM)) {
        profiler.decontaminatedRows += 1;
        continue;
      }

      const record = request.processing.redactPii ? redactRow(result.row) : result.row;
      const tokens = estimateTokens(text);
      const flags = rowFlags(text, tokens, MAX_TRAINING_TOKENS);
      const split = assignSplit(await sha256Hex(`${request.split.seed}:${rowHash}`), request.split);

      if (flags.length > 0 && flaggedIndexes[split].length < MAX_FLAGGED_INDEXES) {
        flaggedIndexes[split].push(counts[split]);
      }

      await writers[split].writeLine(record);
      counts[split] += 1;
      accepted += 1;
      chain = await sha256Hex(`${chain}${rowHash}`);
      profiler.add({
        split,
        tokens,
        text,
        redactedText: canonicalText(record),
        flagged: flags.length > 0,
      });
    }

    const sizes = {
      train: await writers.train.close(),
      validation: await writers.validation.close(),
      test: await writers.test.close(),
    };
    const result = profiler.result();

    if (result.rows === 0) {
      throw new Error(
        `No usable rows (${result.invalidRows} invalid, ${result.duplicatesRemoved} duplicates)`,
      );
    }

    const finalStats: DatasetStats = { ...stats, ...result, flaggedIndexes };
    const piiBefore = Object.values(result.piiBefore).reduce((sum, value) => sum + value, 0);
    const piiAfter = Object.values(result.piiAfter).reduce((sum, value) => sum + value, 0);
    const evidence: AddEvidenceInput[] = [
      {
        versionId,
        kind: "format",
        source: "dataset_pipeline",
        status: "pass",
        summary: `${result.rows.toLocaleString("en-GB")} ${mapping.shape.replace(/_/g, " ")} rows in canonical JSONL`,
        details: { mapping, invalidRows: result.invalidRows },
      },
      {
        versionId,
        kind: "dataset_stats",
        source: "dataset_pipeline",
        status: result.flaggedRows > 0 ? "warn" : "pass",
        summary: `About ${result.tokens.toLocaleString("en-GB")} tokens; ${result.duplicatesRemoved} duplicates removed; ${result.flaggedRows} rows flagged for review`,
        details: { ...result },
      },
      {
        versionId,
        kind: "pii",
        source: "dataset_pipeline",
        status: piiAfter > 0 ? "fail" : piiBefore > 0 ? "warn" : "pass",
        summary:
          piiAfter > 0
            ? `${piiAfter} personal data matches remain`
            : piiBefore > 0
              ? `${piiBefore} personal data matches redacted`
              : "No personal data patterns found",
        details: {
          before: result.piiBefore,
          after: result.piiAfter,
          redacted: request.processing.redactPii,
        },
      },
      {
        versionId,
        kind: "licence",
        source: "dataset_pipeline",
        status: licenceStatus(profile.governance.licence),
        summary: `Declared licence ${profile.governance.licence}`,
        details: { licence: profile.governance.licence },
      },
      {
        versionId,
        kind: "provenance",
        source: "dataset_pipeline",
        status: profile.governance.lawfulBasis === "unknown" ? "warn" : "pass",
        summary: `Collected by ${profile.collection_method}; lawful basis ${profile.governance.lawfulBasis.replace(/_/g, " ")}`,
        details: { ...profile.governance, sourceRef: profile.source_ref },
      },
      {
        versionId,
        kind: "decontamination",
        source: "dataset_pipeline",
        status: request.processing.decontaminateSuiteIds.length === 0 ? "unknown" : "pass",
        summary:
          request.processing.decontaminateSuiteIds.length === 0
            ? "No eval suites were protected"
            : `${result.decontaminatedRows} rows overlapping eval suites removed`,
        details: { suiteIds: request.processing.decontaminateSuiteIds },
      },
    ];

    if (request.source === "synthetic") {
      const route = await repositories.modelRoutes.getRoute(
        profile.workspace_id,
        request.teacher.routeId,
      );
      const restricted = route ? RESTRICTED_TEACHER_PROVIDERS.has(route.provider) : false;

      evidence.push({
        versionId,
        kind: "teacher_terms",
        source: "dataset_pipeline",
        status: restricted ? "fail" : "pass",
        summary: restricted
          ? `Generated by ${route?.provider}, whose terms restrict training competing models on outputs`
          : `Generated by ${route?.provider ?? "an open model"}`,
        details: { routeId: request.teacher.routeId, provider: route?.provider ?? null },
      });
    }

    await repositories.modelGovernance.addEvidence(evidence);
    await repositories.modelAssets.finaliseRevision(versionId, {
      revision: chain,
      attributes: {
        ...version.attributes,
        totalBytes: sizes.train + sizes.validation + sizes.test,
      },
      files: (["train", "validation", "test"] as const)
        .filter((split) => counts[split] > 0)
        .map((split) => ({
          path: `${split}.jsonl`,
          size: sizes[split],
          sha256: null,
          format: null,
        })),
    });
    await repositories.modelAssets.updateVersion(versionId, {
      status: "ready",
      failure_reason: null,
    });
    await repositories.modelDatasets.update(versionId, {
      status: "ready",
      stats: finalStats,
      mapping,
      shape: mapping.shape,
      processed_at: new Date().toISOString(),
      failure_reason: null,
    });
    await syncVersionReviews(repositories, profile.workspace_id, versionId);

    return { status: "success", message: `Processed ${result.rows} rows` };
  } catch (error) {
    const reason = getErrorMessage(error, "Processing failed");

    logger.error("Dataset processing failed", { versionId, error: reason });
    await repositories.modelDatasets.update(versionId, {
      status: "failed",
      failure_reason: reason,
      stats,
    });
    await repositories.modelAssets.updateVersion(versionId, {
      status: "failed",
      failure_reason: reason,
    });

    return { status: "error", message: reason };
  }
}
