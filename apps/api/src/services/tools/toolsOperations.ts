import { availableFunctions } from "~/services/functions";

export function getAvailableTools(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return availableFunctions.map((tool) => ({
    id: tool.name,
    name: tool.name,
    description: tool.description,
  }));
}
