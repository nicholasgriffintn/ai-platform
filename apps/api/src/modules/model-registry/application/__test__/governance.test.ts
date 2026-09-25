import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";
import type {
  EvidenceKind,
  EvidenceStatus,
  ModelVersionAttributes,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";

import { ModelAssetRepository } from "../../infrastructure/ModelAssetRepository";
import { ModelEvalRepository } from "../../infrastructure/ModelEvalRepository";
import { ModelGovernanceRepository } from "../../infrastructure/ModelGovernanceRepository";
import { ModelRouteRepository } from "../../infrastructure/ModelRouteRepository";
import {
  expireDecisions,
  requestDecision,
  resolveDecision,
  syncVersionReviews,
} from "../decisions";
import { resolveProjectModelGovernance } from "../enforcement";
import { listLibrary } from "../library";
import { upsertPolicy } from "../policies";
import { loadRegistryScope, routeStanding, versionStanding } from "../scope";

const WORKSPACE = "ws-1";
const OTHER_WORKSPACE = "ws-2";
const PROJECT = "project-1";
const FOREIGN_PROJECT = "project-foreign";
const ADMIN = { id: 1, plan_id: "pro" };
const MEMBER = { id: 2, plan_id: "pro" };

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});

let database: D1Database;
let repositories: RepositoryManager;
let audit: Array<{ action: string; targetId?: string | null }>;

const REGISTRY_TABLES_CHILD_FIRST = [
  "model_build",
  "model_eval_run",
  "model_eval_suite",
  "model_decision",
  "model_lineage_edge",
  "model_route",
  "model_policy_revision",
  "model_policy",
  "model_evidence",
  "model_asset_file",
  "model_asset_version",
  "model_asset",
];

afterAll(async () => {
  await runtime.dispose();
});

beforeAll(async () => {
  database = await runtime.getD1Database("DB");

  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE workspace (id TEXT PRIMARY KEY)"),
    database.prepare("CREATE TABLE project (id TEXT PRIMARY KEY)"),
    database.prepare("INSERT INTO user VALUES (1), (2)"),
    database.prepare(`INSERT INTO workspace VALUES ('${WORKSPACE}'), ('${OTHER_WORKSPACE}')`),
    database.prepare(`INSERT INTO project VALUES ('${PROJECT}'), ('${FOREIGN_PROJECT}')`),
  ]);

  const migration = await readFile(
    new URL("../../../../../migrations/0052_model_registry.sql", import.meta.url),
    "utf8",
  );

  for (const statement of migration.split("--> statement-breakpoint")) {
    await database.prepare(statement).run();
  }
});

beforeEach(async () => {
  await database.batch(
    REGISTRY_TABLES_CHILD_FIRST.map((table) => database.prepare(`DELETE FROM ${table}`)),
  );

  audit = [];

  const env = { DB: database };
  const registry = {
    modelAssets: new ModelAssetRepository(env),
    modelGovernance: new ModelGovernanceRepository(env),
    modelRoutes: new ModelRouteRepository(env),
    modelEvals: new ModelEvalRepository(env),
    audit: {
      createRecord: async (record: { action: string; targetId?: string | null }) => {
        audit.push(record);
      },
    },
    workspaces: {
      getWorkspace: async (id: string) => ({ id }),
      getMembership: async (workspaceId: string, userId: number) =>
        workspaceId === WORKSPACE ? { role: userId === ADMIN.id ? "admin" : "member" } : null,
      getProject: async (id: string) =>
        id === PROJECT
          ? { id, workspace_id: WORKSPACE }
          : id === FOREIGN_PROJECT
            ? { id, workspace_id: OTHER_WORKSPACE }
            : null,
    },
  };

  repositories = registry as unknown as RepositoryManager;
});

function contextFor(user: typeof ADMIN): ServiceContext {
  return { env: {}, repositories, requireUser: () => user } as unknown as ServiceContext;
}

const baseAttributes: ModelVersionAttributes = {
  licence: "apache-2.0",
  formats: ["safetensors"],
  parameterCount: 7_000_000_000,
  gated: false,
  remoteCode: false,
  pipelineTag: "text-generation",
  libraryName: "transformers",
  tags: [],
  baseModels: [],
  totalBytes: 1,
  trainingComputeFlops: null,
};

async function importedVersion(
  attributes: Partial<ModelVersionAttributes>,
  evidence: Array<[EvidenceKind, EvidenceStatus]>,
): Promise<string> {
  const asset = await repositories.modelAssets.createAsset({
    workspaceId: WORKSPACE,
    kind: "model",
    source: "huggingface",
    sourceRef: `org/model-${Math.random().toString(36).slice(2)}`,
    displayName: "model",
    createdBy: MEMBER.id,
  });
  const version = await repositories.modelAssets.createVersion({
    assetId: asset.id,
    workspaceId: WORKSPACE,
    revision: "a".repeat(40),
    attributes: { ...baseAttributes, ...attributes },
    status: "ready",
    createdBy: MEMBER.id,
    files: [{ path: "model.safetensors", size: 1, sha256: "b".repeat(64), format: "safetensors" }],
  });

  await repositories.modelGovernance.addEvidence(
    [["format", "pass"] as const, ["hub_scan", "pass"] as const, ...evidence].map(
      ([kind, status]) => ({
        versionId: version.id,
        kind,
        source: "static_inspection" as const,
        status,
        summary: `${kind} ${status}`,
      }),
    ),
  );

  return version.id;
}

async function isUsable(versionId: string, projectId: string | null = null) {
  const scope = await loadRegistryScope(repositories, WORKSPACE, projectId, {
    versionIds: [versionId],
  });

  return versionStanding(scope, scope.versions[0])?.usable;
}

describe("registries larger than a D1 statement allows", () => {
  it("imports many files and evidence rows and loads scopes over many versions", async () => {
    const asset = await repositories.modelAssets.createAsset({
      workspaceId: WORKSPACE,
      kind: "model",
      source: "huggingface",
      sourceRef: "org/sharded",
      displayName: "sharded",
      createdBy: MEMBER.id,
    });
    const versionIds: string[] = [];

    for (let index = 0; index < 101; index += 1) {
      const version = await repositories.modelAssets.createVersion({
        assetId: asset.id,
        workspaceId: WORKSPACE,
        revision: index.toString(16).padStart(40, "0"),
        attributes: baseAttributes,
        status: "ready",
        createdBy: MEMBER.id,
        files:
          index === 0
            ? Array.from({ length: 150 }, (_, shard) => ({
                path: `model-${shard}.safetensors`,
                size: 1,
                sha256: shard.toString(16).padStart(64, "0"),
                format: "safetensors" as const,
              }))
            : [],
      });

      versionIds.push(version.id);
    }

    const evidence = await repositories.modelGovernance.addEvidence(
      Array.from({ length: 40 }, (_, index) => ({
        versionId: versionIds[0],
        kind: "public_eval" as const,
        source: "community_eval" as const,
        status: "pass" as const,
        summary: `benchmark ${index}`,
      })),
    );
    const scope = await loadRegistryScope(repositories, WORKSPACE, null, { versionIds });

    expect(await repositories.modelAssets.listFiles(versionIds[0])).toHaveLength(150);
    expect(evidence).toHaveLength(40);
    expect(scope.versions).toHaveLength(101);
    expect(scope.evidence).toHaveLength(40);
  });
});

describe("model governance", () => {
  it("approves clean models automatically and records the system as approver", async () => {
    const versionId = await importedVersion({}, []);

    const [decision] = await syncVersionReviews(repositories, WORKSPACE, versionId);

    expect(decision).toMatchObject({ state: "approved", decided_by: null });
    expect(await isUsable(versionId)).toBe(true);
    expect(audit.map((record) => record.action)).toEqual(["model_decision.auto_approved"]);
  });

  it("holds remote code for review, lets only admins approve, and reopens on new issues", async () => {
    const versionId = await importedVersion({ remoteCode: true }, [["remote_code", "warn"]]);

    const [pending] = await syncVersionReviews(repositories, WORKSPACE, versionId);

    expect(pending.state).toBe("pending");
    expect(await isUsable(versionId)).toBe(false);

    const again = await requestDecision(contextFor(MEMBER), WORKSPACE, {
      versionId,
      projectId: null,
      exception: false,
    });

    expect(again.id).toBe(pending.id);
    await expect(
      resolveDecision(contextFor(MEMBER), WORKSPACE, pending.id, { state: "approved" }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await resolveDecision(contextFor(ADMIN), WORKSPACE, pending.id, { state: "approved" });

    expect(await isUsable(versionId)).toBe(true);
    expect(
      (await listLibrary(contextFor(MEMBER), WORKSPACE, { approvedOnly: true })).entries.map(
        (entry) => entry.version.id,
      ),
    ).toEqual([versionId]);

    await repositories.modelGovernance.addEvidence([
      { versionId, kind: "drift", source: "replay", status: "fail", summary: "fell 6 points" },
    ]);

    const [reopened] = await syncVersionReviews(repositories, WORKSPACE, versionId);

    expect(reopened).toMatchObject({ state: "pending", note: "Review reopened: no-drift" });
    expect(await isUsable(versionId)).toBe(false);
  });

  it("refuses blocked versions unless an exception is approved, and lets exceptions expire", async () => {
    const versionId = await importedVersion({ formats: ["pickle"] }, [["pickle_imports", "fail"]]);

    await expect(
      requestDecision(contextFor(MEMBER), WORKSPACE, {
        versionId,
        projectId: null,
        exception: false,
      }),
    ).rejects.toBeInstanceOf(AssistantError);

    const exception = await requestDecision(contextFor(MEMBER), WORKSPACE, {
      versionId,
      projectId: null,
      exception: true,
      note: "Needed for a legacy migration",
    });
    const approved = await resolveDecision(contextFor(ADMIN), WORKSPACE, exception.id, {
      state: "approved",
    });
    const days = (new Date(approved.expiresAt ?? 0).getTime() - Date.now()) / 86_400_000;

    expect(Math.round(days)).toBe(90);
    expect(await isUsable(versionId)).toBe(true);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 91 * 86_400_000);

    try {
      expect(await expireDecisions(repositories)).toBe(1);
      expect(await isUsable(versionId)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets a project policy narrow routes and enforces approved routes in project chats", async () => {
    const versionId = await importedVersion({}, []);

    await syncVersionReviews(repositories, WORKSPACE, versionId);

    const usRoute = await repositories.modelRoutes.createRoute({
      workspaceId: WORKSPACE,
      versionId,
      provider: "together-ai",
      providerModelId: "model-us",
      region: "us",
      weightsVerified: true,
      createdBy: MEMBER.id,
    });
    const euRoute = await repositories.modelRoutes.createRoute({
      workspaceId: WORKSPACE,
      versionId,
      provider: "regolo-ai",
      providerModelId: "model-eu",
      region: "eu",
      weightsVerified: true,
      createdBy: MEMBER.id,
    });

    await upsertPolicy(contextFor(ADMIN), WORKSPACE, {
      projectId: PROJECT,
      rules: [
        {
          id: "uk-eu-only",
          effect: "block",
          when: { type: "route_region", op: "not_in", values: ["uk", "eu"] },
        },
      ],
    });
    await expect(
      upsertPolicy(contextFor(ADMIN), WORKSPACE, { projectId: FOREIGN_PROJECT, rules: [] }),
    ).rejects.toMatchObject({ statusCode: 404 });

    const workspaceScope = await loadRegistryScope(repositories, WORKSPACE, null);
    const projectScope = await loadRegistryScope(repositories, WORKSPACE, PROJECT);

    expect(routeStanding(workspaceScope, usRoute)?.usable).toBe(true);
    expect(routeStanding(projectScope, usRoute)?.usable).toBe(false);
    expect(routeStanding(projectScope, euRoute)?.usable).toBe(true);

    const advisory = await resolveProjectModelGovernance(repositories, {
      id: PROJECT,
      workspace_id: WORKSPACE,
    });

    expect(advisory.enforced).toBe(false);
    expect(advisory.routeFor({ id: "model-eu", provider: "regolo-ai" })?.routeId).toBe(euRoute.id);

    await upsertPolicy(contextFor(ADMIN), WORKSPACE, {
      projectId: null,
      rules: [],
      enforcement: "enforced",
    });

    const enforced = await resolveProjectModelGovernance(repositories, {
      id: PROJECT,
      workspace_id: WORKSPACE,
    });

    expect(enforced.enforced).toBe(true);
    expect(enforced.approved).toEqual([
      { id: "model-eu", provider: "regolo-ai", routeId: euRoute.id, versionId },
    ]);
    expect(enforced.routeFor({ id: "model-us", provider: "together-ai" })).toBeUndefined();
    expect(audit.filter((record) => record.action === "model_policy.updated")).toHaveLength(2);
  });
});
