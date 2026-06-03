import type { SandboxRunData } from "@assistant/schemas";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";

const ARTIFACT_PREFIX = "sandbox/runs";

interface RunArtifactDescriptor {
	name: string;
	key: string;
	url?: string;
	contentType: string;
	sizeBytes: number;
}

interface RunArtifactManifest {
	runId: string;
	repo: string;
	task: string;
	status: SandboxRunData["status"];
	startedAt: string;
	updatedAt: string;
	completedAt?: string;
	items: RunArtifactDescriptor[];
}

function toSafeRunId(runId: string): string {
	return runId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildArtifactKey(runId: string, fileName: string): string {
	return `${ARTIFACT_PREFIX}/${toSafeRunId(runId)}/${fileName}`;
}

function shouldPersistArtifact(run: SandboxRunData): boolean {
	const logs = run.result?.logs;
	const diff = run.result?.diff;
	const hasEvents = Array.isArray(run.events) && run.events.length > 0;
	return Boolean((typeof logs === "string" && logs.length > 0) || diff || hasEvents);
}

async function putArtifact(params: {
	serviceContext: ServiceContext;
	ownerUserId: number;
	runId: string;
	fileName: string;
	contentType: string;
	content: string;
}): Promise<RunArtifactDescriptor> {
	const key = buildArtifactKey(params.runId, params.fileName);
	const contentSize = new TextEncoder().encode(params.content).byteLength;
	const storedArtifact = await StorageService.forPrivateAssets(
		params.serviceContext,
	).storePrivateAsset({
		key,
		data: params.content,
		ownerUserId: params.ownerUserId,
		purpose: "sandbox_artifact",
		mimeType: params.contentType,
		filename: params.fileName,
		byteSize: contentSize,
	});
	return {
		name: params.fileName,
		key,
		url: storedArtifact.url,
		contentType: params.contentType,
		sizeBytes: contentSize,
	};
}

export async function persistSandboxRunArtifact(params: {
	serviceContext: ServiceContext;
	ownerUserId: number;
	run: SandboxRunData;
}): Promise<SandboxRunData> {
	const { serviceContext, run } = params;
	if (!serviceContext.env.PRIVATE_ASSETS_BUCKET || !shouldPersistArtifact(run)) {
		return run;
	}

	const items: RunArtifactDescriptor[] = [];
	const logs = run.result?.logs;
	const diff = run.result?.diff;
	const events = run.events ?? [];

	if (typeof logs === "string" && logs.length > 0) {
		items.push(
			await putArtifact({
				serviceContext,
				ownerUserId: params.ownerUserId,
				runId: run.runId,
				fileName: "logs.txt",
				contentType: "text/plain; charset=utf-8",
				content: logs,
			}),
		);
	}

	if (typeof diff === "string" && diff.trim().length > 0) {
		items.push(
			await putArtifact({
				serviceContext,
				ownerUserId: params.ownerUserId,
				runId: run.runId,
				fileName: "diff.patch",
				contentType: "text/x-diff; charset=utf-8",
				content: diff,
			}),
		);
	}

	if (events.length > 0) {
		const content = events.map((event) => JSON.stringify(event)).join("\n");
		items.push(
			await putArtifact({
				serviceContext,
				ownerUserId: params.ownerUserId,
				runId: run.runId,
				fileName: "events.ndjson",
				contentType: "application/x-ndjson",
				content,
			}),
		);
	}

	if (run.result) {
		items.push(
			await putArtifact({
				serviceContext,
				ownerUserId: params.ownerUserId,
				runId: run.runId,
				fileName: "result.json",
				contentType: "application/json",
				content: JSON.stringify(run.result, null, 2),
			}),
		);
	}

	const manifest: RunArtifactManifest = {
		runId: run.runId,
		repo: run.repo,
		task: run.task,
		status: run.status,
		startedAt: run.startedAt,
		updatedAt: run.updatedAt,
		completedAt: run.completedAt,
		items,
	};
	const manifestArtifact = await putArtifact({
		serviceContext,
		ownerUserId: params.ownerUserId,
		runId: run.runId,
		fileName: "manifest.json",
		contentType: "application/json",
		content: JSON.stringify(manifest, null, 2),
	});

	const logsArtifact = items.find((item) => item.name === "logs.txt");

	return {
		...run,
		artifactKey: manifestArtifact.key,
		artifactUrl: manifestArtifact.url,
		result: run.result
			? {
					...run.result,
					logs: undefined,
					diff: undefined,
					logsArtifactKey: logsArtifact?.key ?? manifestArtifact.key,
					logsArtifactUrl: logsArtifact?.url ?? manifestArtifact.url,
					artifactManifestKey: manifestArtifact.key,
					artifactManifestUrl: manifestArtifact.url,
					artifactItems: items,
				}
			: {
					success: run.status === "completed",
					artifactManifestKey: manifestArtifact.key,
					artifactManifestUrl: manifestArtifact.url,
					artifactItems: items,
				},
	};
}
