import { useMemo } from "react";

import {
	getModelToolOptions,
	type ModelToolModelCapabilities,
	type ModelToolOption,
} from "~/lib/model-tools";
import { useCapabilityCatalog } from "./useCapabilityCatalog";

export function useModelToolOptions(
	modelCapabilities: ModelToolModelCapabilities | undefined,
): ModelToolOption[] {
	const { data: catalog } = useCapabilityCatalog();

	return useMemo(
		() => getModelToolOptions(modelCapabilities, catalog?.modelTools ?? []),
		[catalog?.modelTools, modelCapabilities],
	);
}
