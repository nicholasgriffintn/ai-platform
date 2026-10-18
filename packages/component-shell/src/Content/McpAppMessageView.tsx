import { McpAppView, type ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import { themeAppearance } from "@ngriffin_uk/polychat-library-chat";
import { callMcpAppTool } from "@ngriffin_uk/polychat-library-client";
import { useResolvedThemeId } from "@ngriffin_uk/polychat-library-react";
import { MCP_CALL_TOOL_NAME, mcpAppViewSchema } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { useCallback } from "react";

export function McpAppMessageView({
  data,
  onToolInteraction,
}: {
  data: unknown;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const parsed = mcpAppViewSchema.safeParse(isRecord(data) ? data.app : undefined);
  const theme = themeAppearance(useResolvedThemeId());
  const callTool = useCallback(
    (tool: string, args: Record<string, unknown>) =>
      parsed.success
        ? callMcpAppTool({ integration: parsed.data.integration, tool, arguments: args })
        : Promise.reject(new Error("The app is no longer attached to an integration")),
    [parsed],
  );
  const onMessage = useCallback(
    (text: string) => {
      void onToolInteraction?.(MCP_CALL_TOOL_NAME, "useAsPrompt", { input: text });
    },
    [onToolInteraction],
  );

  if (!parsed.success) {
    return null;
  }

  return <McpAppView app={parsed.data} theme={theme} callTool={callTool} onMessage={onMessage} />;
}
