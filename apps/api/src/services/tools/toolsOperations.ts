import type { Tool } from "@assistant/schemas";
import { listFunctionTools } from "~/services/functions";
import { formatFunctionName } from "~/utils/functions";
import { getToolCategory } from "./toolCategories";

export function getAvailableTools(isPro = false, isSignedIn = false): Tool[] {
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
			name: formatFunctionName(tool.name),
			description: tool.description,
			category: getToolCategory(tool.name),
			isDefault: isPro ? tool.isDefault || false : false,
		}));
}
