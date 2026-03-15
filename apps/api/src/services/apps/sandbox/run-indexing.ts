import type { SandboxRunData } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getEmbeddingProvider } from "~/lib/providers/capabilities/embedding/helpers";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/sandbox/run-indexing" });

const MAX_INDEXED_CHARS = 12000;

function toIndexableContent(run: SandboxRunData): string {
	const summary =
		typeof run.result?.summary === "string" ? run.result.summary : "";
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

function toSandboxRunNamespace(userId: number): string {
	return `sandbox_runs_user_${userId}`;
}

export async function indexSandboxRunResult(params: {
	serviceContext: ServiceContext;
	userId: number;
	run: SandboxRunData;
}): Promise<void> {
	const { serviceContext, userId, run } = params;
	if (!serviceContext.env.AI || !serviceContext.env.VECTOR_DB) {
		return;
	}
	if (run.status !== "completed" && run.status !== "failed") {
		return;
	}

	const content = toIndexableContent(run);
	if (!content.trim()) {
		return;
	}

	try {
		const user = await serviceContext.repositories.users.getUserById(userId);
		if (!user) {
			return;
		}
		const userSettings =
			await serviceContext.repositories.userSettings.getUserSettings(userId);
		const embeddingProvider = getEmbeddingProvider(
			serviceContext.env,
			user,
			userSettings ?? undefined,
		);
		const embeddingId = `sandbox-run-${run.runId}`;
		const embeddings = await embeddingProvider.generate(
			"sandbox_run",
			content,
			embeddingId,
			{
				runId: run.runId,
				repo: run.repo,
				status: run.status,
				startedAt: run.startedAt,
				completedAt: run.completedAt ?? "",
			},
		);
		await embeddingProvider.insert(embeddings, {
			namespace: toSandboxRunNamespace(userId),
			topK: 10,
			returnMetadata: "none",
		});
	} catch (error) {
		logger.warn("Sandbox run indexing failed", {
			run_id: run.runId,
			user_id: userId,
			error_message: error instanceof Error ? error.message : String(error),
		});
	}
}
