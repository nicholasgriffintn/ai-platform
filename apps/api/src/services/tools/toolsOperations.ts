import { availableFunctions } from "~/services/functions";

export function getAvailableTools(isPro = false): Array<{
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
}> {
  return availableFunctions
    .filter((tool) => {
      if (tool.type === "premium" && !isPro) {
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
