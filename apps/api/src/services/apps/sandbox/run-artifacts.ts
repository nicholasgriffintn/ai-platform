import type { SandboxRunArtifactReference, SandboxRunData } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";

import { buildSandboxRunManifest } from "./run-manifest";

const ARTIFACT_PREFIX = "sandbox/runs";

interface StoredRunArtifact extends SandboxRunArtifactReference {
  key: string;
}

function toSafeRunId(runId: string): string {
  return runId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildArtifactKey(runId: string, fileName: string): string {
  return `${ARTIFACT_PREFIX}/${toSafeRunId(runId)}/${fileName}`;
}

function buildArtifactOutputId(runId: string, fileName: string): string {
  return `sandbox-${toSafeRunId(runId)}-${fileName.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

async function putArtifact(params: {
  serviceContext: ServiceContext;
  ownerUserId: number;
  projectId?: string | null;
  conversationId?: string | null;
  runId: string;
  fileName: string;
  kind: string;
  contentType: string;
  content: string;
}): Promise<StoredRunArtifact> {
  const key = buildArtifactKey(params.runId, params.fileName);
  const contentSize = new TextEncoder().encode(params.content).byteLength;
  const storedArtifact = await StorageService.forPrivateAssets(
    params.serviceContext,
  ).storeOutputFile({
    outputId: buildArtifactOutputId(params.runId, params.fileName),
    key,
    data: params.content,
    createdByUserId: params.ownerUserId,
    projectId: params.projectId,
    conversationId: params.conversationId,
    capabilityId: "sandbox",
    groupId: params.runId,
    kind: "sandbox_artifact",
    title: params.fileName,
    content: { runId: params.runId },
    mimeType: params.contentType,
    filename: params.fileName,
    byteSize: contentSize,
  });

  return {
    outputId: storedArtifact.outputId,
    name: params.fileName,
    kind: params.kind,
    key,
    url: storedArtifact.url,
    contentType: params.contentType,
    sizeBytes: contentSize,
  };
}

function toArtifactReference(artifact: StoredRunArtifact): SandboxRunArtifactReference {
  return {
    outputId: artifact.outputId,
    name: artifact.name,
    kind: artifact.kind,
    contentType: artifact.contentType,
    sizeBytes: artifact.sizeBytes,
    url: artifact.url,
  };
}

function mergeArtifactReferences(
  previous: SandboxRunArtifactReference[] | undefined,
  next: SandboxRunArtifactReference[],
): SandboxRunArtifactReference[] {
  const byOutputId = new Map(
    [...(previous ?? []), ...next].map((artifact) => [artifact.outputId, artifact]),
  );

  return Array.from(byOutputId.values());
}

function withoutInlineArtifacts(result: SandboxRunData["result"]): SandboxRunData["result"] {
  if (!result) {
    return undefined;
  }

  const next = { ...result };

  delete next.logs;
  delete next.diff;
  delete next.logsArtifactKey;
  delete next.artifactManifestKey;

  return next;
}

export async function persistSandboxRunArtifact(params: {
  serviceContext: ServiceContext;
  ownerUserId: number;
  projectId?: string | null;
  conversationId?: string | null;
  run: SandboxRunData;
}): Promise<SandboxRunData> {
  const { serviceContext, run } = params;

  if (!serviceContext.env.PRIVATE_ASSETS_BUCKET) {
    return { ...run, manifest: buildSandboxRunManifest({ run }) };
  }

  const items: StoredRunArtifact[] = [];
  const resourceScope = {
    projectId: params.projectId,
    conversationId: params.conversationId,
  };
  const logs = run.result?.logs;
  const diff = run.result?.diff;
  const events = run.events ?? [];

  if (typeof logs === "string" && logs.length > 0) {
    items.push(
      await putArtifact({
        ...resourceScope,
        serviceContext,
        ownerUserId: params.ownerUserId,
        runId: run.runId,
        fileName: "logs.txt",
        kind: "logs",
        contentType: "text/plain; charset=utf-8",
        content: logs,
      }),
    );
  }

  if (typeof diff === "string" && diff.trim().length > 0) {
    items.push(
      await putArtifact({
        ...resourceScope,
        serviceContext,
        ownerUserId: params.ownerUserId,
        runId: run.runId,
        fileName: "diff.patch",
        kind: "diff",
        contentType: "text/x-diff; charset=utf-8",
        content: diff,
      }),
    );
  }

  if (events.length > 0) {
    const content = events.map((event) => JSON.stringify(event)).join("\n");

    items.push(
      await putArtifact({
        ...resourceScope,
        serviceContext,
        ownerUserId: params.ownerUserId,
        runId: run.runId,
        fileName: "events.ndjson",
        kind: "events",
        contentType: "application/x-ndjson",
        content,
      }),
    );
  }

  if (run.result) {
    items.push(
      await putArtifact({
        ...resourceScope,
        serviceContext,
        ownerUserId: params.ownerUserId,
        runId: run.runId,
        fileName: "result.json",
        kind: "result",
        contentType: "application/json",
        content: JSON.stringify(run.result, null, 2),
      }),
    );
  }

  const artifactReferences = mergeArtifactReferences(
    run.manifest?.artifacts,
    items.map(toArtifactReference),
  );
  const manifest = buildSandboxRunManifest({ run, artifacts: artifactReferences });
  const manifestArtifact = await putArtifact({
    ...resourceScope,
    serviceContext,
    ownerUserId: params.ownerUserId,
    runId: run.runId,
    fileName: "manifest.json",
    kind: "manifest",
    contentType: "application/json",
    content: JSON.stringify(manifest, null, 2),
  });

  const logsArtifact = items.find((item) => item.name === "logs.txt");
  const compactResult = withoutInlineArtifacts(run.result);

  return {
    ...run,
    artifactKey: undefined,
    artifactUrl: manifestArtifact.url,
    manifest,
    result: compactResult
      ? {
          ...compactResult,
          logsArtifactUrl: logsArtifact?.url ?? manifestArtifact.url,
          artifactManifestUrl: manifestArtifact.url,
          artifactItems: artifactReferences,
        }
      : {
          success: run.status === "completed",
          artifactManifestUrl: manifestArtifact.url,
          artifactItems: artifactReferences,
        },
  };
}
