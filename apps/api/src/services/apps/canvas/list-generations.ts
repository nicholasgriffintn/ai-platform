import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import type { CanvasGenerationListItem, CanvasMode } from "./types";
import { mapCanvasGenerationRecord } from "./records";

export const listCanvasGenerations = async ({
	context,
	env,
	userId,
	mode,
}: {
	context?: ServiceContext;
	env?: IEnv;
	userId: number;
	mode?: CanvasMode;
}): Promise<CanvasGenerationListItem[]> => {
	const serviceContext = resolveServiceContext({ context, env });

	const records =
		await serviceContext.repositories.appData.getAppDataByUserAndApp(
			userId,
			"canvas",
		);

	const mapped = records.map(mapCanvasGenerationRecord);

	if (!mode) {
		return mapped;
	}

	return mapped.filter((generation) => generation.mode === mode);
};
