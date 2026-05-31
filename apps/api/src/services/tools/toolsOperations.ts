import { listFunctionTools } from "~/services/functions";

export function getAvailableTools(
	isPro = false,
	isSignedIn = false,
): Array<{
	id: string;
	name: string;
	description: string;
	isDefault: boolean;
}> {
	return listFunctionTools()
		.filter((tool) => {
			if (tool.type === "premium" && !isPro) {
				return false;
			}
			if (tool.type === "byok" && !isSignedIn) {
				return false;
			}
			return true;
		})
		.map((tool) => ({
			id: tool.name,
			name: tool.name,
			description: tool.description,
			isDefault: tool.isDefault || false,
		}));
}
