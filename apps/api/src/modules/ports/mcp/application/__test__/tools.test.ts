import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { callMcpPortTool, callWorkMcpTool, listMcpPortTools, listWorkMcpTools } from "../tools";

const mocks = vi.hoisted(() => ({
  runToolDirectly: vi.fn(),
  startTeammate: vi.fn(),
}));

vi.mock("~/modules/tools/application/direct-run", () => ({
  runToolDirectly: mocks.runToolDirectly,
}));

vi.mock("~/modules/tools/application/toolsOperations", () => ({
  getScopedAvailableTools: async () => [{ id: "web_search" }, { id: "write_document" }],
}));

vi.mock("~/modules/tools/application/catalogue", () => ({
  listFunctionToolDefinitions: () => [
    {
      name: "web_search",
      description: "Search the web",
      inputSchema: z.object({ query: z.string() }),
      effects: { effectClass: "read" },
    },
    {
      name: "write_document",
      description: "Write a document",
      inputSchema: z.object({ title: z.string() }),
      effects: { effectClass: () => "write" },
    },
    {
      name: "create_image",
      description: "Premium only",
      inputSchema: z.object({}),
      effects: { effectClass: "draft" },
    },
    {
      name: "list_tasks",
      description: "List the project's tasks",
      inputSchema: z.object({}),
      effects: { effectClass: "read" },
    },
    {
      name: "post_update",
      description: "Post to a task thread",
      inputSchema: z.object({ taskId: z.string(), body: z.string() }),
      effects: { effectClass: "draft" },
    },
  ],
}));

vi.mock("~/modules/teammates/application/listing", () => ({
  listScopedTeammateSummaries: async () => [
    { id: "teammate-1", name: "Ada", description: "Research lead" },
  ],
}));

vi.mock("~/modules/teammates/application/external-runs", () => ({
  startExternalTeammateResponse: mocks.startTeammate,
}));

const context: ServiceContext = Object.assign(Object.create(null), {
  requireUser: () => ({ id: 1 }),
});

describe("MCP port tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the caller's registry tools with effect hints, then one tool per teammate", async () => {
    await expect(listMcpPortTools(context)).resolves.toMatchObject([
      { name: "web_search", annotations: { readOnlyHint: true, destructiveHint: false } },
      { name: "write_document", inputSchema: { properties: { title: {} } } },
      { name: "teammate.teammate-1", title: "Ask Ada" },
    ]);
  });

  it("runs registry tools under channel authority and returns refusals as tool errors", async () => {
    mocks.runToolDirectly.mockResolvedValueOnce({
      output_id: "output-1",
      data: { result: { status: "success", content: "3 results" } },
    });

    await expect(
      callMcpPortTool(context, {
        name: "web_search",
        arguments: { query: "parrots" },
        appUrl: "https://api.polychat.app",
      }),
    ).resolves.toMatchObject({ content: [{ text: "3 results" }] });
    expect(mocks.runToolDirectly).toHaveBeenCalledWith(
      expect.objectContaining({
        toolId: "web_search",
        platform: "mcp",
        authority: { trigger: "channel", autonomyLevel: "assistant" },
      }),
    );

    mocks.runToolDirectly.mockRejectedValueOnce(
      new AssistantError("Approve write_document in Polychat", ErrorType.AUTHORISATION_ERROR, 403),
    );

    await expect(
      callMcpPortTool(context, { name: "write_document", arguments: {}, appUrl: "" }),
    ).resolves.toEqual({
      content: [{ type: "text", text: "Approve write_document in Polychat" }],
      isError: true,
    });
    await expect(
      callMcpPortTool(context, { name: "create_image", arguments: {}, appUrl: "" }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it("starts a teammate Response and says when the reply is still on its way", async () => {
    mocks.startTeammate.mockResolvedValue({
      id: "response-1",
      conversation_id: "conversation-1",
      status: "awaiting_approval",
      output: [],
    });

    await expect(
      callMcpPortTool(context, {
        name: "teammate.teammate-1",
        arguments: { message: "Draft the brief" },
        appUrl: "",
      }),
    ).resolves.toMatchObject({
      content: [{ text: "Ada is awaiting approval; the reply lands in Polychat." }],
      structuredContent: { response_id: "response-1", status: "awaiting_approval" },
    });
    expect(mocks.startTeammate).toHaveBeenCalledWith(context, {
      teammateId: "teammate-1",
      text: "Draft the brief",
      platform: "mcp",
    });
  });

  const access = {
    userId: 1,
    projectId: "project-1",
    teammateContextId: "context-1",
    conversationId: "task-conversation",
    toolIds: ["list_tasks", "post_update"],
  };

  it("offers a desktop Work run only the tools granted to that run", () => {
    expect(listWorkMcpTools(access).map((tool) => tool.name)).toEqual([
      "list_tasks",
      "post_update",
    ]);
  });

  it("runs Work tools as the run's teammate in its project and refuses anything else", async () => {
    mocks.runToolDirectly.mockResolvedValueOnce({
      output_id: null,
      data: { result: { status: "success", content: "LNCH-1 Ship quoted selections" } },
    });

    await expect(
      callWorkMcpTool(context, access, {
        name: "list_tasks",
        arguments: {},
        appUrl: "https://app",
      }),
    ).resolves.toMatchObject({ content: [{ text: "LNCH-1 Ship quoted selections" }] });
    expect(mocks.runToolDirectly).toHaveBeenCalledWith(
      expect.objectContaining({
        toolId: "list_tasks",
        projectId: "project-1",
        teammateContextId: "context-1",
        authority: { trigger: "handle", autonomyLevel: "partner" },
      }),
    );

    await expect(
      callWorkMcpTool(context, access, {
        name: "web_search",
        arguments: { query: "x" },
        appUrl: "https://app",
      }),
    ).rejects.toThrow("Unknown tool: web_search");
  });
});
