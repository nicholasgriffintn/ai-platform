import {
  Client,
  StreamableHTTPClientTransport,
  specTypeSchemas,
  type CallToolResult,
} from "@modelcontextprotocol/client";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/client/validators/cf-worker";
import {
  getIntegrationToolChanges,
  integrationConnectionSchema,
  integrationSnapshotSchema,
  integrationToolSchema,
  type IntegrationSnapshot,
  type IntegrationTool,
} from "@ngriffin_uk/polychat-schemas";
import {
  redactKnownSecret,
  redactSensitiveTokens,
} from "@ngriffin_uk/polychat-utility-server/redaction";

import { createNativeMcpFetch, MAX_NATIVE_MCP_BYTES } from "./http.js";
import { createIntegrationSnapshot } from "./snapshots.js";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_TOOL_PAGES = 50;
const MAX_TOOLS = 500;
const validator = new CfWorkerJsonSchemaValidator();

export class NativeMcpError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNAVAILABLE"
      | "INVALID_INPUT"
      | "DEFINITION_CHANGED"
      | "UNKNOWN_OUTCOME",
  ) {
    super(message);
    this.name = "NativeMcpError";
  }
}

async function withNativeMcpClient<T>(
  settings: Pick<IntegrationSnapshot, "endpoint" | "authentication"> & { token?: string },
  work: (client: Client, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const credentials = integrationConnectionSchema.parse({ token: settings.token });

  if ((settings.authentication === "bearer") !== Boolean(credentials.token)) {
    throw new NativeMcpError(
      "Provide only the personal token required by this integration",
      "INVALID_INPUT",
    );
  }

  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const client = new Client(
    { name: "Polychat", version: "1.0.0" },
    {
      capabilities: {},
      jsonSchemaValidator: validator,
      listMaxPages: MAX_TOOL_PAGES,
      versionNegotiation: { mode: "auto" },
    },
  );
  const transport = new StreamableHTTPClientTransport(new URL(settings.endpoint), {
    fetch: createNativeMcpFetch(settings.endpoint, credentials.token, signal),
    reconnectionOptions: {
      maxRetries: 0,
      maxReconnectionDelay: 0,
      initialReconnectionDelay: 0,
      reconnectionDelayGrowFactor: 1,
    },
    reconnectionScheduler: () => undefined,
  });

  try {
    await client.connect(transport, { signal, timeout: REQUEST_TIMEOUT_MS });

    return await work(client, signal);
  } catch (error) {
    if (error instanceof NativeMcpError) {
      throw error;
    }

    throw new NativeMcpError(
      "The integration service is unavailable or returned an invalid response",
      "UNAVAILABLE",
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function discoverTools(
  client: Client,
  signal: AbortSignal,
  token?: string,
): Promise<IntegrationTool[]> {
  const tools: unknown[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < MAX_TOOL_PAGES; page += 1) {
    const result = await client.request(
      { method: "tools/list", params: cursor ? { cursor } : {} },
      { signal, timeout: REQUEST_TIMEOUT_MS },
    );

    tools.push(...result.tools);

    if (
      tools.length > MAX_TOOLS ||
      new TextEncoder().encode(JSON.stringify(tools)).byteLength > MAX_NATIVE_MCP_BYTES
    ) {
      throw new NativeMcpError(
        "The service exceeds the 500-action or 2 MiB integration definition limit",
        "UNAVAILABLE",
      );
    }

    if (!result.nextCursor) {
      return tools.map((tool) => integrationToolSchema.parse(redactKnownSecret(tool, token)));
    }

    if (cursors.has(result.nextCursor)) {
      throw new NativeMcpError("The service returned a repeated tools cursor", "UNAVAILABLE");
    }

    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }

  throw new NativeMcpError("The service exceeds the integration discovery limit", "UNAVAILABLE");
}

export async function discoverNativeMcpSnapshot(
  settings: Pick<IntegrationSnapshot, "endpoint" | "authentication"> & { token?: string },
): Promise<IntegrationSnapshot> {
  return withNativeMcpClient(settings, async (client, signal) =>
    createIntegrationSnapshot({
      endpoint: settings.endpoint,
      authentication: settings.authentication,
      tools: await discoverTools(client, signal, settings.token),
    }),
  );
}

export function validateNativeMcpArguments(
  tool: IntegrationTool,
  params: Record<string, unknown>,
): void {
  try {
    if (validator.getValidator(tool.inputSchema)(params).valid) {
      return;
    }
  } catch {
    throw new NativeMcpError(
      "The reviewed action has an unsupported input schema; review the service definition",
      "DEFINITION_CHANGED",
    );
  }

  throw new NativeMcpError(
    "Action parameters do not match the reviewed input schema",
    "INVALID_INPUT",
  );
}

function formatNativeMcpResult(result: CallToolResult, token?: string) {
  return redactSensitiveTokens(
    {
      isError: result.isError === true,
      content: result.content.flatMap((block) =>
        block.type === "text" ? [{ type: "text" as const, text: block.text }] : [],
      ),
      ...(result.structuredContent ? { structuredContent: result.structuredContent } : {}),
      omittedContent: result.content
        .filter((block) => block.type !== "text")
        .map((block) => block.type),
    },
    token,
  );
}

export async function executeNativeMcpOperation(params: {
  snapshot: IntegrationSnapshot;
  token?: string;
  operation: string;
  params: Record<string, unknown>;
  beforeExecute: () => Promise<void>;
}) {
  const snapshot = integrationSnapshotSchema.parse(params.snapshot);
  const reviewedTool = snapshot.tools.find((tool) => tool.name === params.operation);

  if (!reviewedTool) {
    throw new NativeMcpError(
      "This action is not in the reviewed integration definition",
      "DEFINITION_CHANGED",
    );
  }

  validateNativeMcpArguments(reviewedTool, params.params);

  return withNativeMcpClient({ ...snapshot, token: params.token }, async (client, signal) => {
    const current = await createIntegrationSnapshot({
      endpoint: snapshot.endpoint,
      authentication: snapshot.authentication,
      tools: await discoverTools(client, signal, params.token),
    });
    const changes = getIntegrationToolChanges(snapshot, current);

    if (changes.removed.includes(params.operation) || changes.changed.includes(params.operation)) {
      throw new NativeMcpError(
        "The action changed since review. Review the service changes before granting its new definition",
        "DEFINITION_CHANGED",
      );
    }

    const definition = specTypeSchemas.Tool["~standard"].validate(reviewedTool);

    if (definition.issues) {
      throw new NativeMcpError(
        "The reviewed action has an invalid MCP definition; review the service definition",
        "DEFINITION_CHANGED",
      );
    }

    await params.beforeExecute();

    if (signal.aborted) {
      throw new NativeMcpError(
        "The integration check timed out before the action was dispatched",
        "UNAVAILABLE",
      );
    }

    let result: CallToolResult;

    try {
      result = await client.callTool(
        { name: params.operation, arguments: params.params },
        { signal, timeout: REQUEST_TIMEOUT_MS, toolDefinition: definition.value },
      );
    } catch {
      throw new NativeMcpError(
        "The action outcome is unknown. Check the service before attempting it again",
        "UNKNOWN_OUTCOME",
      );
    }

    if (reviewedTool.outputSchema && !result.isError) {
      try {
        if (!validator.getValidator(reviewedTool.outputSchema)(result.structuredContent).valid) {
          throw new Error("Invalid action output");
        }
      } catch {
        throw new NativeMcpError(
          "The action returned an invalid result. Check the service before attempting it again",
          "UNKNOWN_OUTCOME",
        );
      }
    }

    return formatNativeMcpResult(result, params.token);
  });
}
