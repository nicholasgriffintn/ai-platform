import {
  sandboxEnvironmentCacheRecordSchema,
  sandboxEnvironmentSetupSchema,
  toSandboxEnvironmentCacheSummary,
  type SandboxEnvironmentCacheAction,
  type SandboxEnvironmentCacheActionResponse,
  type SandboxEnvironmentCacheRecord,
  type SandboxEnvironmentSetup,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ProjectRow } from "~/repositories/WorkspaceRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import { requireProjectAccess } from "./access";

const logger = getLogger({ prefix: "services/workspaces/environment-cache" });
const BACKUP_ARCHIVE_OBJECT_NAME = "data.sqsh";
const BACKUP_METADATA_OBJECT_NAME = "meta.json";

function parseCacheRecord(project: ProjectRow): SandboxEnvironmentCacheRecord | undefined {
  if (!project.coding_environment_cache) {
    return undefined;
  }

  const parsed = sandboxEnvironmentCacheRecordSchema.safeParse(
    safeParseJson(project.coding_environment_cache),
  );

  return parsed.success ? parsed.data : undefined;
}

function parseEnvironmentSetup(project: ProjectRow): SandboxEnvironmentSetup | undefined {
  if (!project.coding_environment_setup) {
    return undefined;
  }

  const parsed = sandboxEnvironmentSetupSchema.safeParse(
    safeParseJson(project.coding_environment_setup),
  );

  if (!parsed.success) {
    throw new AssistantError(
      "The project environment setup is invalid",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return parsed.data;
}

function backupObjectKeys(backupId: string): [string, string] {
  return [
    `backups/${backupId}/${BACKUP_ARCHIVE_OBJECT_NAME}`,
    `backups/${backupId}/${BACKUP_METADATA_OBJECT_NAME}`,
  ];
}

async function deleteBackupObjects(
  context: ServiceContext,
  backupId: string,
): Promise<"deleted" | "failed"> {
  const bucket = context.env.PRIVATE_ASSETS_BUCKET;

  if (!bucket) {
    return "failed";
  }

  try {
    await bucket.delete(backupObjectKeys(backupId));

    return "deleted";
  } catch (error) {
    logger.error("Failed to delete sandbox environment snapshot", {
      error,
    });

    return "failed";
  }
}

async function getBackupSize(
  context: ServiceContext,
  backupId: string,
): Promise<number | undefined> {
  const bucket = context.env.PRIVATE_ASSETS_BUCKET;

  if (!bucket) {
    return undefined;
  }

  try {
    const object = await bucket.head(backupObjectKeys(backupId)[0]);

    return typeof object?.size === "number" ? object.size : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveProjectEnvironmentCacheForRun(params: {
  context: ServiceContext;
  projectId: string;
  repository: string;
  installationId: number;
}): Promise<{
  environmentSetup?: SandboxEnvironmentSetup;
  environmentCache?: SandboxEnvironmentCacheRecord;
  environmentCacheGeneration: number;
}> {
  const { project } = await requireProjectAccess(params.context, params.projectId);

  if (
    project.coding_enabled !== 1 ||
    project.coding_repository?.toLowerCase() !== params.repository.toLowerCase() ||
    project.coding_installation_id !== params.installationId
  ) {
    throw new AssistantError(
      "The sandbox request does not match the current project coding environment",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const environmentSetup = parseEnvironmentSetup(project);

  return {
    environmentSetup,
    environmentCache: environmentSetup ? parseCacheRecord(project) : undefined,
    environmentCacheGeneration: project.coding_cache_generation ?? 0,
  };
}

export async function invalidateProjectEnvironmentCacheForConfiguration(
  context: ServiceContext,
  project: ProjectRow,
): Promise<void> {
  const cache = parseCacheRecord(project);
  const invalidatedAt = new Date().toISOString();
  const invalidated = cache
    ? {
        ...cache,
        status: "invalidated" as const,
        invalidationReason: "configuration_changed",
        invalidatedAt,
      }
    : null;

  await context.repositories.workspaces.invalidateProjectEnvironmentCache(
    project.id,
    invalidated ? JSON.stringify(invalidated) : null,
  );

  if (cache && (await deleteBackupObjects(context, cache.backupId)) === "failed") {
    logger.error("Project configuration changed but its old environment snapshot was not deleted", {
      project_id: project.id,
    });
  }
}

export async function applyProjectEnvironmentCacheAction(
  context: ServiceContext,
  projectId: string,
  input: SandboxEnvironmentCacheAction,
): Promise<SandboxEnvironmentCacheActionResponse> {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const cache = parseCacheRecord(project);
  const invalidatedAt = new Date().toISOString();
  const invalidated = cache
    ? {
        ...cache,
        status: "invalidated" as const,
        invalidationReason: input.action === "rebuild" ? "manual_rebuild" : "manual_delete",
        invalidatedAt,
      }
    : null;

  await context.repositories.workspaces.invalidateProjectEnvironmentCache(
    projectId,
    invalidated ? JSON.stringify(invalidated) : null,
  );

  const storageDeletion = cache ? await deleteBackupObjects(context, cache.backupId) : "not_found";

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action:
      input.action === "rebuild"
        ? "project.environment_cache.rebuild_requested"
        : "project.environment_cache.deleted",
    targetType: "project",
    targetId: projectId,
    metadata: { storageDeletion },
  });

  return {
    environmentCache: invalidated ? toSandboxEnvironmentCacheSummary(invalidated) : null,
    storageDeletion,
    warning:
      storageDeletion === "failed"
        ? "The cache was invalidated, but its stored snapshot could not be deleted."
        : undefined,
  };
}

export async function persistProjectEnvironmentCacheCandidate(params: {
  context: ServiceContext;
  projectId: string;
  userId: number;
  repository: string;
  installationId: number;
  candidate: SandboxEnvironmentCacheRecord;
  candidateWasReused?: boolean;
  replaceExistingCache?: boolean;
}): Promise<void> {
  const project = await params.context.repositories.workspaces.getProject(params.projectId);

  if (!project) {
    if (!params.candidateWasReused) {
      await deleteBackupObjects(params.context, params.candidate.backupId);
    }

    return;
  }

  const membership = await params.context.repositories.workspaces.getMembership(
    project.workspace_id,
    params.userId,
  );
  const generation = project.coding_cache_generation ?? 0;
  const setupIsCurrent = Boolean(parseEnvironmentSetup(project));
  const boundaryMatches =
    membership &&
    project.coding_enabled === 1 &&
    project.coding_repository?.toLowerCase() === params.repository.toLowerCase() &&
    project.coding_installation_id === params.installationId &&
    generation === params.candidate.generation &&
    setupIsCurrent;

  if (!boundaryMatches) {
    if (!params.candidateWasReused) {
      await deleteBackupObjects(params.context, params.candidate.backupId);
    }

    return;
  }

  const current = parseCacheRecord(project);

  if (current?.status === "ready" && current.cacheKey === params.candidate.cacheKey) {
    if (current.backupId !== params.candidate.backupId) {
      if (params.replaceExistingCache) {
        const candidate = {
          ...params.candidate,
          sizeBytes: await getBackupSize(params.context, params.candidate.backupId),
        };
        const replaced =
          await params.context.repositories.workspaces.replaceProjectEnvironmentCache(
            params.projectId,
            generation,
            current.backupId,
            JSON.stringify(candidate),
          );

        if (replaced) {
          await deleteBackupObjects(params.context, current.backupId);

          return;
        }
      }

      await deleteBackupObjects(params.context, params.candidate.backupId);

      return;
    }

    await params.context.repositories.workspaces.touchProjectEnvironmentCache(
      params.projectId,
      generation,
      current.backupId,
      JSON.stringify(params.candidate),
    );

    return;
  }

  const sizeBytes = await getBackupSize(params.context, params.candidate.backupId);
  const candidate = {
    ...params.candidate,
    sizeBytes,
  };
  const stored = await params.context.repositories.workspaces.storeProjectEnvironmentCache(
    params.projectId,
    generation,
    candidate.cacheKey,
    JSON.stringify(candidate),
  );

  if (!stored) {
    await deleteBackupObjects(params.context, candidate.backupId);
  }
}
