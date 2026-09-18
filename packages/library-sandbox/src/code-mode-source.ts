import { TOOLS_ORIGIN } from "./outbound.js";

export interface CodeModeToolDescription {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolProxySourceOptions {
  tools: readonly CodeModeToolDescription[];
  binding?: string;
  toolsOrigin?: string;
}

export const DEFAULT_TOOLS_BINDING = "tools";

export function renderToolProxySource(options: ToolProxySourceOptions): string {
  const binding = options.binding ?? DEFAULT_TOOLS_BINDING;
  const origin = options.toolsOrigin ?? TOOLS_ORIGIN;
  const entries = options.tools.map(
    (tool) =>
      `${JSON.stringify(tool.name)}: (args) => __callTool__(${JSON.stringify(tool.name)}, args)`,
  );

  return `
async function __callTool__(name, args) {
  const response = await fetch(${JSON.stringify(origin)} + "/" + encodeURIComponent(name), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });
  const payload = await response.json().catch(() => ({ ok: false, error: { message: "Tool returned a non-JSON response" } }));

  if (!response.ok || payload.ok === false) {
    const failure = new Error(payload?.error?.message ?? "Tool " + name + " failed");
    failure.name = "ToolError";
    throw failure;
  }

  return payload.result;
}

const ${binding} = Object.freeze({
  ${entries.join(",\n  ")}
});
`;
}

function schemaSummary(schema: Record<string, unknown> | undefined): string {
  if (!schema || typeof schema.properties !== "object" || schema.properties === null) {
    return "{}";
  }

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const fields = Object.entries(schema.properties as Record<string, unknown>).map(
    ([key, value]) => {
      const type =
        value && typeof value === "object" && "type" in value ? String(value.type) : "unknown";
      const optional = required.has(key) ? "" : "?";

      return `${key}${optional}: ${type}`;
    },
  );

  return `{ ${fields.join(", ")} }`;
}

export function describeToolsForModel(
  tools: readonly CodeModeToolDescription[],
  binding = DEFAULT_TOOLS_BINDING,
): string {
  return tools
    .map((tool) => {
      const signature = `${binding}.${tool.name}(${schemaSummary(tool.inputSchema)}): Promise<unknown>`;

      return tool.description ? `${signature}\n  ${tool.description}` : signature;
    })
    .join("\n");
}
