import type { ServiceContext } from "~/lib/context/serviceContext";
import { safeParseJson } from "~/utils/json";
import { isAbortError } from "~/utils/abort";
import { parseSandboxRunData, type SandboxRunData } from "./run-data";

export const RUN_CANCELLATION_MESSAGE = "Run cancelled by user";

export { isAbortError };

export async function persistFailedRun(params: {
	serviceContext: ServiceContext;
	recordId: string;
	initialRunData: SandboxRunData;
	error: unknown;
}): Promise<void> {
	const { serviceContext, recordId, initialRunData, error } = params;
	const errorMessage =
		error instanceof Error ? error.message : "Sandbox execution failed";
	const completedAt = new Date().toISOString();

	await serviceContext.repositories.appData.updateAppData(recordId, {
		...initialRunData,
		status: "failed",
		error: errorMessage.slice(0, 1000),
		updatedAt: completedAt,
		completedAt,
	});
}

export async function getPersistedCancelledRun(params: {
	serviceContext: ServiceContext;
	recordId: string;
}): Promise<SandboxRunData | null> {
	const record =
		await params.serviceContext.repositories.appData.getAppDataById(
			params.recordId,
		);
	if (!record?.data) {
		return null;
	}

	const parsed = parseSandboxRunData(
		typeof record.data === "string" ? safeParseJson(record.data) : record.data,
	);
	if (!parsed || parsed.status !== "cancelled") {
		return null;
	}

	return parsed;
}
