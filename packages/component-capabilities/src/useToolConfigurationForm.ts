import {
  parseModelToolConfiguration,
  type ModelToolDefinition,
  type ModelToolConfiguration,
} from "@ngriffin_uk/polychat-schemas";
import {
  generateId,
  splitNonEmptyLines,
  parseCommaSeparatedList,
} from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import type { McpServerFieldValue } from "./McpServerFields";

export function useToolConfigurationForm(
  tool: ModelToolDefinition | null,
  storedConfiguration: Record<string, unknown> | undefined,
  onSubmit: (configuration: ModelToolConfiguration) => Promise<void>,
) {
  const [vectorStoreIds, setVectorStoreIds] = useState("");
  const [servers, setServers] = useState<McpServerFieldValue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previous, setPrevious] = useState<{
    tool: ModelToolDefinition | null;
    storedConfiguration: Record<string, unknown> | undefined;
  } | null>(null);

  if (previous?.tool !== tool || previous?.storedConfiguration !== storedConfiguration) {
    setPrevious({ tool, storedConfiguration });
    if (tool) {
      const saved = parseModelToolConfiguration(tool, storedConfiguration ?? {});

      setVectorStoreIds(saved && "vectorStoreIds" in saved ? saved.vectorStoreIds.join("\n") : "");
      setServers(
        saved && "servers" in saved
          ? saved.servers.map((server) => ({ ...server, id: generateId() }))
          : [{ id: generateId(), label: "", url: "" }],
      );
      setError(null);
    }
  }

  const submit = async () => {
    if (!tool) {
      return;
    }

    let candidate: unknown;

    if (tool.configurationKind === "file_search") {
      const lines = splitNonEmptyLines(vectorStoreIds);

      candidate = { vectorStoreIds: lines.flatMap(parseCommaSeparatedList) };
    } else {
      const configuredServers = [];

      for (const server of servers) {
        configuredServers.push({
          label: server.label,
          url: server.url,
          credentialConnectionId: server.credentialConnectionId,
          allowedTools: server.allowedTools,
        });
      }

      candidate = { servers: configuredServers };
    }

    const configuration = parseModelToolConfiguration(tool, candidate);

    if (!configuration) {
      setError(`Complete the required ${tool.label} configuration.`);

      return;
    }

    try {
      await onSubmit(configuration);
    } catch {
      setError("The configuration could not be saved.");
    }
  };

  return { vectorStoreIds, setVectorStoreIds, servers, setServers, error, submit };
}
