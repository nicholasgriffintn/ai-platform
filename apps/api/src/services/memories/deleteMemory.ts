import { MemoryManager } from "~/lib/memory";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleDeleteMemory = async (
	context: ServiceContext,
	memoryId: string,
): Promise<Record<string, unknown>> => {
	context.ensureDatabase();
	const user = context.requireUser();

	const memoryManager = MemoryManager.getInstance(context.env, user);

	const deleted = await memoryManager.deleteMemory(memoryId);

	if (!deleted) {
		throw new AssistantError(
			"Memory not found or access denied",
			ErrorType.NOT_FOUND,
		);
	}

	return {
		success: true,
	};
};
