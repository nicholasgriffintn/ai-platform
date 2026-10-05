import {
  assertJsonComplexity,
  formatUnknownValue,
  isRecord,
} from "@ngriffin_uk/polychat-utility-core";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { readRecordPath } from "@ngriffin_uk/polychat-utility-server/record-fields";

const HEADER_TOKEN = /^[!#$%&'*+.^_`|~A-Za-z0-9-]+$/;

interface McpParameterHeader {
  name: string;
  path: string[];
  type: "string" | "integer" | "boolean";
}

function encodeMcpHeader(value: string) {
  if (
    !/^[\x20-\x7e]*$/.test(value) ||
    value.trim() !== value ||
    (value.startsWith("=?base64?") && value.endsWith("?="))
  ) {
    return `=?base64?${bufferToBase64(new TextEncoder().encode(value))}?=`;
  }

  return value;
}

export function readMcpParameterHeaders(schema: Record<string, unknown>): McpParameterHeader[] {
  assertJsonComplexity(schema);
  const pending: { value: unknown; path: string[]; reachable: boolean }[] = [
    { value: schema, path: [], reachable: true },
  ];
  const headers: McpParameterHeader[] = [];
  const names = new Set<string>();

  while (pending.length) {
    const node = pending.pop();

    if (!node || (!isRecord(node.value) && !Array.isArray(node.value))) {
      continue;
    }

    const value = node.value;

    if (isRecord(value) && Object.hasOwn(value, "x-mcp-header")) {
      const name = value["x-mcp-header"];
      const type = value.type;

      if (
        !node.reachable ||
        !node.path.length ||
        typeof name !== "string" ||
        name.length > 80 ||
        !HEADER_TOKEN.test(name) ||
        names.has(name.toLowerCase()) ||
        (type !== "string" && type !== "integer" && type !== "boolean") ||
        headers.length >= 32
      ) {
        throw new Error("Invalid MCP parameter header annotation");
      }

      names.add(name.toLowerCase());
      headers.push({ name: `Mcp-Param-${name}`, path: node.path, type });
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === "properties" && node.reachable && isRecord(child)) {
        for (const [property, definition] of Object.entries(child)) {
          pending.push({ value: definition, path: [...node.path, property], reachable: true });
        }
      } else if (isRecord(child) || Array.isArray(child)) {
        pending.push({ value: child, path: node.path, reachable: false });
      }
    }
  }

  return headers;
}

export function buildMcpHeaders(
  method: string,
  protocolVersion: string,
  tool?: { name: string; inputSchema: Record<string, unknown>; params: Record<string, unknown> },
): Headers {
  const headers = new Headers({
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "MCP-Protocol-Version": protocolVersion,
    "Mcp-Method": method,
  });

  if (tool) {
    headers.set("Mcp-Name", encodeMcpHeader(tool.name));

    for (const mapping of readMcpParameterHeaders(tool.inputSchema)) {
      const value = readRecordPath(tool.params, mapping.path);

      if (value === null || value === undefined) {
        continue;
      }

      if (
        (mapping.type === "string" && typeof value !== "string") ||
        (mapping.type === "boolean" && typeof value !== "boolean") ||
        (mapping.type === "integer" && (typeof value !== "number" || !Number.isSafeInteger(value)))
      ) {
        throw new Error("MCP parameter header does not match its declared type");
      }

      headers.set(mapping.name, encodeMcpHeader(formatUnknownValue(value)));
    }
  }

  if ([...headers].reduce((size, [name, value]) => size + name.length + value.length, 0) > 8192) {
    throw new Error("MCP headers exceed their size limit");
  }

  return headers;
}
