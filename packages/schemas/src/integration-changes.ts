import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";

import type { IntegrationSnapshot } from "./integrations.js";

export function getIntegrationToolChanges(
  before: IntegrationSnapshot,
  after: IntegrationSnapshot,
): { added: string[]; removed: string[]; changed: string[] } {
  const previous = new Map(before.tools.map((tool) => [tool.name, tool]));
  const current = new Map(after.tools.map((tool) => [tool.name, tool]));

  return {
    added: after.tools.filter((tool) => !previous.has(tool.name)).map((tool) => tool.name),
    removed: before.tools.filter((tool) => !current.has(tool.name)).map((tool) => tool.name),
    changed: after.tools
      .filter((tool) => {
        const old = previous.get(tool.name);

        return (
          old &&
          canonicalJson({
            inputSchema: old.inputSchema,
            outputSchema: old.outputSchema,
            annotations: old.annotations,
          }) !==
            canonicalJson({
              inputSchema: tool.inputSchema,
              outputSchema: tool.outputSchema,
              annotations: tool.annotations,
            })
        );
      })
      .map((tool) => tool.name),
  };
}
