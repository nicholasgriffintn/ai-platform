import { useMemo } from "react";

import {
	getModelToolOptions,
	type ModelToolModelCapabilities,
	type ModelToolOption,
} from "~/lib/model-tools";
import { useDynamicApps } from "./useDynamicApps";

export function useModelToolOptions(
	modelCapabilities: ModelToolModelCapabilities | undefined,
): ModelToolOption[] {
	const { data: dynamicApps } = useDynamicApps();

	return useMemo(
		() => getModelToolOptions(modelCapabilities, dynamicApps?.tools ?? []),
		[dynamicApps?.tools, modelCapabilities],
	);
}
