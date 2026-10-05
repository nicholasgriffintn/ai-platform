import type { NativeMcpTool } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { vi } from "vitest";

import { discoverMcpServer } from "~/modules/mcp/application/discovery";
import { connectMcpServer, createMcpServer } from "~/modules/mcp/application/registry";
import type { ApiToolExecutionContext } from "~/types/functions";

import { createMcpRegistryFixture } from "./mcp-registry";

export async function createMcpRuntimeFixture() {
  const fixture = await createMcpRegistryFixture();
  const tool: NativeMcpTool = {
    name: "create_issue",
    description: "Create an issue",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
      additionalProperties: false,
    },
  };
  const state = {
    tools: [tool],
    calls: 0,
    beforeResult: async () => {},
    resultText: "Issue created",
  };
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (input !== "https://tools.example.test/mcp" || typeof init?.body !== "string") {
      throw new Error("Unexpected fixture request");
    }

    const body = safeParseJson<Record<string, unknown>>(init.body);

    if (!body) {
      throw new Error("Missing fixture request body");
    }

    if (body.method === "server/discover") {
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          resultType: "complete",
          supportedVersions: ["2026-07-28"],
          capabilities: { tools: {} },
        },
      });
    }

    if (body.method === "tools/list") {
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: { resultType: "complete", tools: state.tools },
      });
    }

    if (body.method !== "tools/call") {
      throw new Error("Unexpected fixture method");
    }

    state.calls += 1;
    await state.beforeResult();

    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      result: { resultType: "complete", content: [{ type: "text", text: state.resultText }] },
    });
  });
  const { owner } = fixture;
  const registered = await createMcpServer(owner, {
    label: "Fixture issues",
    endpoint: "https://tools.example.test/mcp",
  });

  await connectMcpServer(owner, registered.id, {
    endpointConsent: true,
    credential: { type: "bearer", value: "synthetic-owner-token" },
    sharedProjectIds: [],
  });
  const server = await discoverMcpServer(owner, registered.id, registered.revision);
  const completionId = "mcp-runtime-conversation";

  await owner.repositories.conversations.createConversation(completionId, owner.requireUser().id);
  const receipt = await owner.repositories.conversationRuns.acceptCommand({
    commandId: "mcp-runtime-command",
    conversationId: completionId,
    digest: "fixture-digest",
    kind: "turn",
    userId: owner.requireUser().id,
    trigger: "user",
  });

  owner.connectorRunId = receipt.run.id;
  await owner.repositories.conversationRuns.transition({
    runId: receipt.run.id,
    attempt: receipt.run.attempt,
    status: "running",
  });
  const execution: ApiToolExecutionContext = {
    completionId,
    toolCallId: "mcp-runtime-call",
    env: owner.env,
    user: owner.requireUser(),
    request: {
      env: owner.env,
      user: owner.requireUser(),
      context: owner,
      request: {
        completion_id: completionId,
        input: "Create an issue",
        date: "2026-10-05",
        tool_options: { native_mcp_server_ids: [server.id] },
      },
    },
  };

  return { ...fixture, server, execution, state, fetchMock };
}
