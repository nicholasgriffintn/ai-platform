import { datasetGovernanceSchema, type ModelPlatformAction } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireModelAction } from "~/modules/model-registry/application/access";
import { loadRegistryScope, isRevoked } from "~/modules/model-registry/application/scope";
import { ArtefactStore, artefactKeys } from "~/modules/model-registry/infrastructure/ArtefactStore";
import { databaseTestEnvironment } from "~/test-utils/environment";
import { initialiseModelPlatformDatabase } from "~/test-utils/model-platform-database";

import {
  excludeDatasetRows,
  previewUploadColumns,
  readDatasetRows,
  requestErasure,
} from "../datasets";

vi.mock("~/modules/model-registry/application/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/model-registry/application/access")>()),
  requireModelAction: vi.fn(),
}));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
  r2Buckets: ["ASSETS"],
});
let context: ServiceContext;
let store: ArtefactStore;
let versionId: string;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");

  await initialiseModelPlatformDatabase(database);
  const env = databaseTestEnvironment(database);

  env.PRIVATE_ASSETS_BUCKET = await runtime.getR2Bucket("ASSETS");
  context = createServiceContext({ env });
  store = new ArtefactStore(env);
  vi.mocked(requireModelAction).mockResolvedValue({
    userId: 1,
    role: "admin",
    actions: new Set<ModelPlatformAction>(["view", "build_datasets"]),
    separationOfDuties: false,
    workspace: {
      id: "workspace",
      name: "Workspace",
      description: "",
      colour: "#000000",
      created_by: 1,
      created_at: "2026-09-26T00:00:00Z",
      updated_at: null,
    },
  });
  vi.spyOn(context.repositories.audit, "createRecord").mockResolvedValue(undefined);
  const asset = await context.repositories.modelAssets.createAsset({
    workspaceId: "workspace",
    kind: "dataset",
    source: "upload",
    sourceRef: "upload/data",
    displayName: "Data",
    createdBy: 1,
  });
  const version = await context.repositories.modelAssets.createVersion({
    assetId: asset.id,
    workspaceId: "workspace",
    revision: "source-revision",
    status: "ready",
    createdBy: 1,
    files: [],
    attributes: {
      licence: "internal",
      formats: [],
      parameterCount: null,
      gated: false,
      remoteCode: false,
      pipelineTag: null,
      libraryName: null,
      tags: [],
      baseModels: [],
      totalBytes: 0,
      trainingComputeFlops: null,
      architecture: null,
      location: null,
    },
  });

  versionId = version.id;
  await context.repositories.modelDatasets.create({
    versionId,
    workspaceId: "workspace",
    shape: "text",
    mapping: { shape: "text", columns: { text: "text" } },
    governance: datasetGovernanceSchema.parse({
      licence: "internal",
      lawfulBasis: "not_personal_data",
    }),
    collectionMethod: "upload",
    sourceRef: "upload/data",
    request: {},
  });
  await context.repositories.modelDatasets.update(versionId, {
    status: "ready",
    stats: {
      rows: 5,
      tokens: 1000,
      flaggedRows: 3,
      flaggedIndexes: { train: [1, 3], validation: [0], test: [] },
      splits: [
        { name: "train", rows: 4, tokens: 900 },
        { name: "validation", rows: 1, tokens: 100 },
        { name: "test", rows: 0, tokens: 0 },
      ],
    },
  });
  await store.putText(
    artefactKeys.datasetSplit("workspace", versionId, "train"),
    ["remove", "flagged", "keep", "also flagged"]
      .map((text) => JSON.stringify({ text }))
      .join("\n"),
    "application/jsonl",
  );
  await store.putText(
    artefactKeys.datasetSplit("workspace", versionId, "validation"),
    JSON.stringify({ text: "validation flagged" }),
    "application/jsonl",
  );
});
afterAll(() => runtime.dispose());

describe("dataset row review", () => {
  it("reports a missing upload instead of waiting on an unclosed preview stream", async () => {
    const upload = await context.repositories.modelUploads.create({
      workspaceId: "workspace",
      purpose: "dataset",
      name: "missing",
      partBytes: 10,
      createdBy: 1,
      files: [
        {
          index: 0,
          path: "data.jsonl",
          size: 10,
          partCount: 1,
          partsUploaded: [1],
          sha256: null,
          key: "missing-file",
          multipartId: "upload",
          etags: { "1": "etag" },
        },
      ],
    });

    await context.repositories.modelUploads.update(upload.id, { status: "ready" });
    await expect(previewUploadColumns(context, "workspace", upload.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
  it("paginates within the flagged subset while retaining original row indexes", async () => {
    const page = await readDatasetRows(context, "workspace", versionId, {
      split: "train",
      offset: 1,
      limit: 1,
      flaggedOnly: true,
    });

    expect(page.total).toBe(2);
    expect(page.rows.map((row) => row.index)).toEqual([3]);
    await expect(
      readDatasetRows(context, "foreign", versionId, {
        split: "train",
        offset: 0,
        limit: 1,
        flaggedOnly: false,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("retains warnings in all splits and recalculates statistics after exclusions", async () => {
    const revised = await excludeDatasetRows(context, "workspace", versionId, {
      split: "train",
      indexes: [0],
      reason: "Remove a row",
    });

    expect(revised.profile).toMatchObject({ rows: 4, flaggedRows: 3 });
    expect(revised.profile?.tokens).toBeLessThan(1000);
    const profile = await context.repositories.modelDatasets.get(revised.versionId);

    expect(profile?.stats.flaggedIndexes).toEqual({ train: [0, 2], validation: [0], test: [] });
    const rows = await readDatasetRows(context, "workspace", revised.versionId, {
      split: "train",
      offset: 0,
      limit: 10,
      flaggedOnly: false,
    });

    expect(rows.rows.map((row) => row.record)).toEqual([
      { text: "flagged" },
      { text: "keep" },
      { text: "also flagged" },
    ]);
    expect(
      (await context.repositories.modelGovernance.listEvidence([revised.versionId])).find(
        (item) => item.kind === "dataset_stats",
      )?.status,
    ).toBe("warn");
  });

  it("rejects nonexistent row indexes before creating another revision", async () => {
    await expect(
      excludeDatasetRows(context, "workspace", versionId, {
        split: "train",
        indexes: [4],
        reason: "Invalid row",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("reuses completed exclusions and safely retries a partially persisted revision", async () => {
    const first = await excludeDatasetRows(context, "workspace", versionId, {
      split: "train",
      indexes: [0],
      reason: "Repeat",
    });
    const repeated = await excludeDatasetRows(context, "workspace", versionId, {
      split: "train",
      indexes: [0, 0],
      reason: "Repeat",
    });

    expect(repeated.versionId).toBe(first.versionId);
    const failure = vi
      .spyOn(context.repositories.modelAssets, "addLineageEdge")
      .mockRejectedValueOnce(new Error("Temporary database failure"));

    await expect(
      excludeDatasetRows(context, "workspace", versionId, {
        split: "train",
        indexes: [2],
        reason: "Retry",
      }),
    ).rejects.toThrow("Temporary database failure");
    failure.mockRestore();
    const retried = await excludeDatasetRows(context, "workspace", versionId, {
      split: "train",
      indexes: [2],
      reason: "Retry",
    });

    expect(retried.profile).toMatchObject({ status: "ready", rows: 4, failureReason: null });
    const files = await context.repositories.modelAssets.listFiles(retried.versionId);

    expect(files.map((file) => file.path)).toEqual(["train.jsonl", "validation.jsonl"]);
  });
});

it("withdraws routes backed by erased rows while preserving the clean revision", async () => {
  const route = await context.repositories.modelRoutes.createRoute({
    workspaceId: "workspace",
    versionId,
    provider: "together-ai",
    providerModelId: "model",
    region: "eu",
    weightsVerified: true,
    createdBy: 1,
  });
  const result = await requestErasure(context, "workspace", versionId, {
    split: "train",
    indexes: [0, 1],
    reason: "Erase these rows",
    action: "withdraw",
    dueInDays: 30,
  });
  const scope = await loadRegistryScope(context.repositories, "workspace", null);

  expect(isRevoked(scope, versionId)).toBe(true);
  expect(isRevoked(scope, result.datasetVersionId)).toBe(false);
  expect((await context.repositories.modelRoutes.getRoute("workspace", route.id))?.status).toBe(
    "retired",
  );
});
