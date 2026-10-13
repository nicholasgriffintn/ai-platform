import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { SandboxRunData } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";

import { getSandboxRunRecordForUser } from "./runs";

const logger = getLogger({ prefix: "services/apps/sandbox/run-indexing" });

const MAX_INDEXED_CHARS = 12000;

function toIndexableContent(run: SandboxRunData): string {
  const summary = typeof run.result?.summary === "string" ? run.result.summary : "";
  const diff = typeof run.result?.diff === "string" ? run.result.diff : "";
  const error = typeof run.error === "string" ? run.error : "";
  const base = [
    `Repository: ${run.repo}`,
    `Task: ${run.task}`,
    `Status: ${run.status}`,
    summary ? `Summary: ${summary}` : "",
    error ? `Error: ${error}` : "",
    diff ? `Diff:\n${diff}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (base.length <= MAX_INDEXED_CHARS) {
    return base;
  }

  return `${base.slice(0, MAX_INDEXED_CHARS)}\n\n[truncated]`;
}

export async function indexSandboxRunResult(params: {
  serviceContext: ServiceContext;
  userId: number;
  run: SandboxRunData;
}): Promise<void> {
  const { serviceContext, userId, run } = params;

  if (run.status !== "completed" && run.status !== "failed") {
    return;
  }

  try {
    const user = await serviceContext.repositories.users.getUserById(userId);

    if (!user) {
      return;
    }

    const context = createServiceContext({ env: serviceContext.env, user });
    const record = await getSandboxRunRecordForUser({ context, userId, runId: run.runId });

    if (
      record.createdByUserId !== userId ||
      (record.run.status !== "completed" && record.run.status !== "failed")
    ) {
      return;
    }

    await context.repositories.sources.upsertRepositorySource({
      id: `sandbox-run-${run.runId}`,
      userId,
      projectId: record.projectId ?? undefined,
      title: `Sandbox run ${run.runId}`.slice(0, 200),
      content: toIndexableContent(record.run),
      metadata: {
        runId: run.runId,
        repo: record.run.repo,
        status: record.run.status,
        startedAt: record.run.startedAt,
        completedAt: record.run.completedAt ?? "",
      },
    });
  } catch (error) {
    logger.warn("Sandbox run indexing failed", {
      run_id: run.runId,
      user_id: userId,
      error_message: getErrorMessage(error),
    });
  }
}
