import { parseChatRequestOptions } from "@ngriffin_uk/polychat-schemas";

import { isRecord } from "~/utils/objects";

const RECIPE_CONNECTOR_TOOL_NAME = "use_recipe_connector";

export function applyFunctionRequestContext(params: {
	args: unknown;
	functionName: string;
	requestOptions: unknown;
}): unknown {
	if (params.functionName !== RECIPE_CONNECTOR_TOOL_NAME) {
		return params.args;
	}

	const provider = parseChatRequestOptions(params.requestOptions)?.connector?.provider;
	if (!provider) {
		return params.args;
	}

	return {
		...(isRecord(params.args) ? params.args : {}),
		provider,
	};
}
