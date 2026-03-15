import type { SandboxRunData } from "@assistant/schemas";
import type { ServiceContext } from "~/lib/context/serviceContext";

const ARTIFACT_PREFIX = "sandbox/runs";

function toSafeRunId(runId: string): string {
	return runId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildArtifactKey(runId: string): string {
	return `${ARTIFACT_PREFIX}/${toSafeRunId(runId)}/final.json`;
}

function buildArtifactUrl(
	baseUrl: string | undefined,
	key: string,
): string | undefined {
	const trimmed = baseUrl?.trim();
	if (!trimmed) {
		return undefined;
	}
	return `${trimmed.replace(/\/$/, "")}/${key}`;
}

function shouldPersistArtifact(run: SandboxRunData): boolean {
	const logs = run.result?.logs;
	const diff = run.result?.diff;
	const hasEvents = Array.isArray(run.events) && run.events.length > 0;
	return Boolean(
		(typeof logs === "string" && logs.length > 0) || diff || hasEvents,
	);
}

export async function persistSandboxRunArtifact(params: {
	serviceContext: ServiceContext;
	run: SandboxRunData;
}): Promise<SandboxRunData> {
	const { serviceContext, run } = params;
	const bucket = serviceContext.env.ASSETS_BUCKET;
	if (!bucket || !shouldPersistArtifact(run)) {
		return run;
	}

	const key = buildArtifactKey(run.runId);
	const payload = {
		runId: run.runId,
		repo: run.repo,
		task: run.task,
		status: run.status,
		startedAt: run.startedAt,
		updatedAt: run.updatedAt,
		completedAt: run.completedAt,
		result: run.result,
		events: run.events ?? [],
	};

	await bucket.put(key, JSON.stringify(payload), {
		httpMetadata: {
			contentType: "application/json",
		},
	});

	return {
		...run,
		artifactKey: key,
		artifactUrl: buildArtifactUrl(serviceContext.env.PUBLIC_ASSETS_URL, key),
		result: run.result
			? {
					...run.result,
					logs: undefined,
					diff: undefined,
					logsArtifactKey: key,
					logsArtifactUrl: buildArtifactUrl(
						serviceContext.env.PUBLIC_ASSETS_URL,
						key,
					),
				}
			: run.result,
	};
}
