import {
  MCP_APP_PROTOCOL_VERSION,
  type McpAppCallToolResult,
  type McpAppCsp,
  type McpAppPermissions,
} from "@ngriffin_uk/polychat-schemas";

export const MCP_APP_SANDBOX = "allow-scripts allow-forms";

const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_INVALID_PARAMS = -32602;
const JSON_RPC_INTERNAL_ERROR = -32603;

const PERMISSION_ALLOW: Record<keyof McpAppPermissions, string> = {
  camera: "camera",
  microphone: "microphone",
  geolocation: "geolocation",
  clipboardWrite: "clipboard-write",
};

function sources(domains: readonly string[] | undefined, fallback: string): string {
  return domains && domains.length > 0 ? domains.join(" ") : fallback;
}

export function buildMcpAppCsp(csp: McpAppCsp | undefined): string {
  const resources = sources(csp?.resourceDomains, "");

  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline' ${resources}`.trim(),
    `style-src 'self' 'unsafe-inline' ${resources}`.trim(),
    `img-src 'self' data: ${resources}`.trim(),
    `font-src 'self' data: ${resources}`.trim(),
    `media-src 'self' data: ${resources}`.trim(),
    `connect-src ${sources(csp?.connectDomains, "'none'")}`,
    `frame-src ${sources(csp?.frameDomains, "'none'")}`,
    `base-uri ${sources(csp?.baseUriDomains, "'self'")}`,
    "object-src 'none'",
  ].join("; ");
}

export function buildMcpAppAllow(permissions: McpAppPermissions | undefined): string {
  return Object.entries(PERMISSION_ALLOW)
    .filter(([key]) => permissions?.[key as keyof McpAppPermissions] !== undefined)
    .map(([, feature]) => feature)
    .join("; ");
}

export function buildMcpAppDocument(html: string, csp: McpAppCsp | undefined): string {
  const policy = `<meta http-equiv="Content-Security-Policy" content="${buildMcpAppCsp(csp)}">`;
  const headStart = html.search(/<head[^>]*>/i);

  if (headStart === -1) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8" />${policy}</head><body style="margin:0">${html}</body></html>`;
  }

  const headEnd = html.indexOf(">", headStart) + 1;

  return `${html.slice(0, headEnd)}${policy}${html.slice(headEnd)}`;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as JsonRpcRequest).jsonrpc === "2.0" &&
    typeof (value as JsonRpcRequest).method === "string"
  );
}

function readParams(params: unknown): Record<string, unknown> {
  return typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
}

export interface McpAppHostCallbacks {
  post: (message: Record<string, unknown>) => void;
  callTool: (tool: string, args: Record<string, unknown>) => Promise<McpAppCallToolResult>;
  openLink: (url: string) => void;
  sendMessage: (text: string) => void;
  resize: (size: { width?: number; height?: number }) => void;
}

export interface McpAppHostBridgeInput {
  toolName: string;
  toolArguments: Record<string, unknown>;
  toolResult: McpAppCallToolResult;
  theme: "light" | "dark";
  callbacks: McpAppHostCallbacks;
}

export interface McpAppHostBridge {
  receive: (message: unknown) => Promise<void>;
  initialised: () => boolean;
}

export function createMcpAppHostBridge(input: McpAppHostBridgeInput): McpAppHostBridge {
  const { callbacks } = input;
  let initialised = false;

  const respond = (id: JsonRpcRequest["id"], result: unknown) => {
    if (id !== undefined && id !== null) {
      callbacks.post({ jsonrpc: "2.0", id, result });
    }
  };

  const fail = (id: JsonRpcRequest["id"], code: number, message: string) => {
    if (id !== undefined && id !== null) {
      callbacks.post({ jsonrpc: "2.0", id, error: { code, message } });
    }
  };

  const notify = (method: string, params: unknown) => {
    callbacks.post({ jsonrpc: "2.0", method, params });
  };

  const handlers: Record<string, (request: JsonRpcRequest) => Promise<void> | void> = {
    "ui/initialize": ({ id }) =>
      respond(id, {
        protocolVersion: MCP_APP_PROTOCOL_VERSION,
        hostInfo: { name: "polychat", version: "1" },
        hostCapabilities: { openLinks: {}, message: {} },
        hostContext: {
          theme: input.theme,
          displayMode: "inline",
          availableDisplayModes: ["inline"],
          toolInfo: { name: input.toolName },
        },
      }),
    "ui/notifications/initialized": () => {
      initialised = true;
      notify("ui/notifications/tool-input", { arguments: input.toolArguments });
      notify("ui/notifications/tool-result", input.toolResult);
    },
    ping: ({ id }) => respond(id, {}),
    "ui/open-link": ({ id, params }) => {
      const url = readParams(params).url;

      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
        fail(id, JSON_RPC_INVALID_PARAMS, "ui/open-link needs an http or https url");

        return;
      }

      callbacks.openLink(url);
      respond(id, {});
    },
    "ui/message": ({ id, params }) => {
      const content = readParams(params).content;
      const text =
        typeof content === "object" && content !== null
          ? (content as { text?: unknown }).text
          : undefined;

      if (typeof text !== "string" || !text.trim()) {
        fail(id, JSON_RPC_INVALID_PARAMS, "ui/message needs text content");

        return;
      }

      callbacks.sendMessage(text);
      respond(id, {});
    },
    "ui/request-display-mode": ({ id }) => respond(id, { mode: "inline" }),
    "ui/update-model-context": ({ id }) => respond(id, {}),
    "ui/notifications/size-changed": ({ params }) => {
      const { width, height } = readParams(params);

      callbacks.resize({
        ...(typeof width === "number" ? { width } : {}),
        ...(typeof height === "number" ? { height } : {}),
      });
    },
    "ui/notifications/request-teardown": () => undefined,
    "tools/call": async ({ id, params }) => {
      const { name, arguments: args } = readParams(params);

      if (typeof name !== "string" || !name) {
        fail(id, JSON_RPC_INVALID_PARAMS, "tools/call needs a tool name");

        return;
      }

      try {
        respond(id, await callbacks.callTool(name, readParams(args)));
      } catch (error) {
        fail(
          id,
          JSON_RPC_INTERNAL_ERROR,
          error instanceof Error ? error.message : "The tool call failed",
        );
      }
    },
  };

  return {
    initialised: () => initialised,
    receive: async (message) => {
      if (!isJsonRpcRequest(message)) {
        return;
      }

      const handler = handlers[message.method];

      if (!handler) {
        fail(message.id, JSON_RPC_METHOD_NOT_FOUND, `${message.method} is not supported here`);

        return;
      }

      await handler(message);
    },
  };
}

export function teardownRequest(reason: string): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    id: "host-teardown",
    method: "ui/resource-teardown",
    params: { reason },
  };
}
