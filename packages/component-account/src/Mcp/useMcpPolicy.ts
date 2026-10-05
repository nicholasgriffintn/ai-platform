import type {
  NativeMcpCatalogTool,
  NativeMcpServer,
  UpdateNativeMcpServer,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function useMcpPolicy(
  server: NativeMcpServer,
  onSave: (input: UpdateNativeMcpServer) => Promise<void>,
) {
  const [enabled, setEnabled] = useState(server.enabled);
  const [tools, setTools] = useState(server.tools);
  const [error, setError] = useState<string>();
  const setAccess = (name: string, access: NativeMcpCatalogTool["access"]) =>
    setTools((current) => current.map((tool) => (tool.name === name ? { ...tool, access } : tool)));
  const save = async () => {
    try {
      await onSave({
        revision: server.revision,
        enabled,
        tools: tools.map(({ name, schemaDigest, access }) => ({ name, schemaDigest, access })),
      });
      setError(undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save tool access");
    }
  };

  return { enabled, setEnabled, tools, setAccess, error, save };
}
