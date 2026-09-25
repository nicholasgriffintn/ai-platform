import type {
  HubFile,
  HubRepoReference,
  HuggingFaceHubClient,
} from "@ngriffin_uk/polychat-ai-model-sources";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  assessPiiSample,
  assessRemoteCode,
  cardEvidence,
  chatTemplateEvidence,
  checkSafetensorsHeaders,
  collectWeightFormats,
  datasetStatsEvidence,
  formatEvidence,
  gatingEvidence,
  hubScanEvidence,
  licenceEvidence,
  pickleEvidence,
  piiEvidence,
  publicEvalEvidence,
  readGgufChatTemplate,
  remoteCodeEvidence,
  scanPickleFile,
  signatureEvidence,
  type EvidenceDraft,
  type InspectableFile,
  type PickleStreamScan,
} from "@ngriffin_uk/polychat-library-model-registry";
import type { ModelVersionAttributes } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, isGitCommitSha, isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { IEnv } from "~/types";

import type { ModelAssetRecord, ModelVersionRecord } from "../infrastructure/ModelAssetRepository";
import { syncVersionReviews } from "./decisions";
import { workspaceHubClient } from "./hub";

const logger = getLogger({ prefix: "modules/model-registry/inspection" });

const MAX_PICKLE_FILES = 5;
const MAX_SAFETENSORS_FILES = 4;
const MAX_GGUF_FILES = 2;
const DATASET_SAMPLE_ROWS = 100;
const MAX_PUBLIC_EVALS = 20;
const JSON_READ_BYTES = 2 * 1024 * 1024;

interface Inspection {
  hub: HuggingFaceHubClient;
  reference: HubRepoReference;
}

function inspectable({ hub, reference }: Inspection, file: HubFile): InspectableFile {
  return {
    path: file.path,
    size: file.size,
    read: (start, end) => hub.fetchRange({ ...reference, path: file.path, start, end }),
  };
}

async function readJson({ hub, reference }: Inspection, path: string): Promise<unknown> {
  const text = await hub.fetchText({ ...reference, path, maxBytes: JSON_READ_BYTES });

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function scanPickles(
  inspection: Inspection,
  files: HubFile[],
): Promise<EvidenceDraft | null> {
  const pickles = files.filter((file) => collectWeightFormats([file.path]).includes("pickle"));

  if (pickles.length === 0) {
    return null;
  }

  const scans: PickleStreamScan[] = [];
  const failures: string[] = [];

  for (const file of pickles.slice(0, MAX_PICKLE_FILES)) {
    try {
      scans.push(...(await scanPickleFile(inspectable(inspection, file))));
    } catch (error) {
      failures.push(`${file.path}: ${getErrorMessage(error, "Unreadable file")}`);
    }
  }

  return pickleEvidence({
    scans,
    hubImports: pickles.flatMap((file) => file.pickleImports),
    failures,
    skippedFiles: pickles.slice(MAX_PICKLE_FILES).map((file) => file.path),
  });
}

async function readChatTemplates(inspection: Inspection, files: HubFile[]): Promise<string[]> {
  const tokenizerConfig = await readJson(inspection, "tokenizer_config.json");
  const templates = [
    isRecord(tokenizerConfig) && typeof tokenizerConfig.chat_template === "string"
      ? tokenizerConfig.chat_template
      : null,
    await inspection.hub.fetchText({ ...inspection.reference, path: "chat_template.jinja" }),
  ];

  for (const file of files.filter((item) => item.path.endsWith(".gguf")).slice(0, MAX_GGUF_FILES)) {
    try {
      templates.push(await readGgufChatTemplate(inspectable(inspection, file)));
    } catch (error) {
      logger.warn("GGUF header inspection failed", {
        path: file.path,
        error: getErrorMessage(error, "Unreadable header"),
      });
    }
  }

  return templates.filter((template): template is string => Boolean(template));
}

async function inspectModel(
  inspection: Inspection,
  version: ModelVersionRecord,
  files: HubFile[],
  info: Awaited<ReturnType<HuggingFaceHubClient["getRepoInfo"]>>,
): Promise<{ evidence: EvidenceDraft[]; attributes: ModelVersionAttributes }> {
  const paths = files.map((file) => file.path);
  const remote = assessRemoteCode(
    info.config ?? (await readJson(inspection, "config.json")),
    paths,
  );
  const headers = await checkSafetensorsHeaders(
    files
      .filter((file) => file.path.endsWith(".safetensors"))
      .map((file) => inspectable(inspection, file)),
    MAX_SAFETENSORS_FILES,
  );
  const pickles = await scanPickles(inspection, files);

  return {
    evidence: [
      formatEvidence("model", paths, headers),
      remoteCodeEvidence(remote),
      chatTemplateEvidence(await readChatTemplates(inspection, files)),
      ...(pickles ? [pickles] : []),
      ...info.publicEvals.slice(0, MAX_PUBLIC_EVALS).map(publicEvalEvidence),
    ],
    attributes: {
      ...version.attributes,
      remoteCode: remote.remoteCode,
      formats: collectWeightFormats(paths),
      parameterCount: version.attributes.parameterCount ?? headers.parameterCount,
    },
  };
}

async function inspectDataset(
  inspection: Inspection,
  asset: ModelAssetRecord,
  files: HubFile[],
): Promise<EvidenceDraft[]> {
  const sample = await inspection.hub.sampleDatasetRows({
    repo: asset.source_ref,
    limit: DATASET_SAMPLE_ROWS,
  });

  return [
    formatEvidence(
      "dataset",
      files.map((file) => file.path),
    ),
    datasetStatsEvidence(sample.totalRows, sample.rows.length),
    piiEvidence(assessPiiSample(sample.rows)),
  ];
}

export async function inspectVersion(
  env: IEnv,
  repositories: RepositoryManager,
  versionId: string,
) {
  const version = await repositories.modelAssets.getVersionById(versionId);
  const asset = version ? await repositories.modelAssets.getAssetById(version.asset_id) : null;

  if (!version || !asset) {
    return { status: "skipped" as const, message: `Version ${versionId} no longer exists` };
  }

  if (!isGitCommitSha(version.revision)) {
    await repositories.modelAssets.updateVersion(versionId, { status: "ready" });
    await syncVersionReviews(repositories, asset.workspace_id, versionId);

    return { status: "success" as const, message: "Only Hub commits carry files to inspect" };
  }

  const inspection: Inspection = {
    hub: await workspaceHubClient(env, repositories, asset.workspace_id),
    reference: { kind: asset.kind, repo: asset.source_ref, revision: version.revision },
  };
  const evidence: EvidenceDraft[] = [];
  const record = (drafts: EvidenceDraft[]) =>
    repositories.modelGovernance.addEvidence(drafts.map((draft) => ({ ...draft, versionId })));

  try {
    const [info, files] = await Promise.all([
      inspection.hub.getRepoInfo(inspection.reference),
      inspection.hub.listFiles(inspection.reference),
    ]);

    evidence.push(
      licenceEvidence(version.attributes.licence, info.licence),
      hubScanEvidence(files),
      gatingEvidence(info.gated),
      cardEvidence(
        await inspection.hub.fetchText({ ...inspection.reference, path: "README.md" }),
        asset.kind,
      ),
      signatureEvidence(files.map((file) => file.path)),
    );

    let attributes = version.attributes;

    if (asset.kind === "model") {
      const model = await inspectModel(inspection, version, files, info);

      evidence.push(...model.evidence);
      attributes = model.attributes;
    } else {
      evidence.push(...(await inspectDataset(inspection, asset, files)));
    }

    await record(evidence);
    await repositories.modelAssets.updateVersion(versionId, {
      status: "ready",
      attributes,
      failure_reason: null,
    });
    await syncVersionReviews(repositories, asset.workspace_id, versionId);

    return { status: "success" as const, message: `Recorded ${evidence.length} evidence item(s)` };
  } catch (error) {
    const reason = getErrorMessage(error, "Inspection failed");

    logger.error("Model version inspection failed", { versionId, error: reason });
    await record(evidence);
    await repositories.modelAssets.updateVersion(versionId, {
      status: "failed",
      failure_reason: reason,
    });

    return { status: "error" as const, message: reason };
  }
}
