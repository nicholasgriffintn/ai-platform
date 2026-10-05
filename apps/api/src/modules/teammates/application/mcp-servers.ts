import { mcpServerSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

export function resolveTeammateMcpServers(value: unknown) {
  const stored = typeof value === "string" ? safeParseJson<unknown>(value) : value;
  const parsed = mcpServerSchema
    .array()
    .max(10)
    .safeParse(stored ?? []);

  if (
    !parsed.success ||
    new Set(parsed.data.map((server) => server.id)).size !== parsed.data.length
  ) {
    throw new AssistantError(
      "Select registered MCP servers for this teammate",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return parsed.data;
}
