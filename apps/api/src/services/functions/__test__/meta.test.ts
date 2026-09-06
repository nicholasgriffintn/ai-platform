import { META_NAVIGATION_DATA_KEY } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";

import {
  find_places,
  hire_teammate,
  list_attention,
  open_place,
  organise_conversation,
  read_conversation,
  start_conversation,
} from "../meta";

vi.mock("~/services/completions/updateChatCompletion", () => ({
  handleUpdateChatCompletion: vi.fn(async () => ({})),
}));

vi.mock("~/services/attention", () => ({
  listWorkAttention: vi.fn(async () => ({
    items: [
      {
        id: "attention-1",
        kind: "approval",
        type: "task",
        resourceId: "task-1",
        workspaceId: "workspace-1",
        workspaceName: "Aviary",
        projectId: "project-1",
        projectName: "Launch week",
        conversationId: null,
        ownerUserId: 7,
        ownerName: "Nick",
        isUnread: true,
        title: "Approve the release note",
        detail: "Waiting since Tuesday",
        occurredAt: "2026-09-01T09:00:00.000Z",
      },
    ],
    total: 1,
    hasMore: false,
    facets: { workspaces: [], projects: [], owners: [] },
  })),
}));

vi.mock("~/services/teammates", () => ({
  hireTeammate: vi.fn(async () => ({
    id: "teammate-1",
    name: "Research analyst",
    kind: "colleague",
  })),
}));

vi.mock("~/services/teammates/access", () => ({
  requireTeammateAccess: vi.fn(async () => ({ id: "teammate-1" })),
}));

vi.mock("~/services/workspaces/access", () => ({
  requireProjectAccess: vi.fn(async () => ({
    project: { id: "project-1", name: "Launch week", workspace_id: "workspace-1" },
  })),
  requireWorkspaceAccess: vi.fn(async () => ({ workspace: { id: "workspace-1", name: "Aviary" } })),
}));

vi.mock("~/services/global-search", () => ({
  searchPolychat: vi.fn(async () => ({
    query: "launch",
    conversations: [],
    projects: [],
    workspaces: [],
  })),
}));

const conversationRow = {
  id: "conversation-1",
  user_id: 7,
  title: "Launch plan",
  project_id: null,
  type: "chat",
};

function createToolContext(conversationType: string | undefined) {
  const repositories = {
    conversations: {
      getConversation: vi.fn(async () => conversationRow),
      getUserConversations: vi.fn(async () => ({ conversations: [conversationRow], total: 1 })),
      createConversation: vi.fn(async () => ({ id: "conversation-2" })),
    },
    messages: {
      getConversationMessages: vi.fn(async () => [
        { role: "user", content: "Plan the launch" },
        { role: "assistant", content: JSON.stringify([{ type: "text", text: "Bundle-first." }]) },
        { role: "tool", content: "ignored" },
      ]),
    },
  };
  const user = { id: 7, plan_id: "pro" };

  return {
    request: {
      env: {},
      user,
      context: {
        repositories,
        user,
        requireUser: () => user,
      },
      request: {
        completion_id: "meta-1",
        conversation_type: conversationType,
      },
    },
  } as never;
}

describe("meta tools", () => {
  it("refuse to run outside the meta scope", async () => {
    for (const tool of [
      find_places,
      open_place,
      organise_conversation,
      read_conversation,
      start_conversation,
      hire_teammate,
      list_attention,
    ]) {
      await expect(
        tool.execute(
          {
            conversationId: "conversation-1",
            action: "pin",
            scope: "personal",
            roleSlug: "research-analyst",
            target: { kind: "place", place: "chat" },
          },
          createToolContext("chat"),
        ),
      ).rejects.toBeInstanceOf(AssistantError);
    }
  });

  it("lists recent conversations when no query is given", async () => {
    const result = await find_places.execute({}, createToolContext("meta"));

    expect(result.status).toBe("success");
    expect(result.data.conversations).toEqual([
      expect.objectContaining({ id: "conversation-1", title: "Launch plan" }),
    ]);
  });

  it("returns a navigation target the client can follow after checking access", async () => {
    const result = await open_place.execute(
      { target: { kind: "conversation", conversationId: "conversation-1" } },
      createToolContext("meta"),
    );

    expect(result.data[META_NAVIGATION_DATA_KEY]).toEqual({
      kind: "conversation",
      conversationId: "conversation-1",
    });
  });

  it("reads a bounded transcript of user and assistant turns only", async () => {
    const result = await read_conversation.execute(
      { conversationId: "conversation-1" },
      createToolContext("meta"),
    );

    expect(result.content).toContain("user: Plan the launch");
    expect(result.content).toContain("assistant: Bundle-first.");
    expect(result.content).not.toContain("ignored");
    expect(result.data.messageCount).toBe(2);
  });

  it("starts a project conversation and hands the opening message to the client", async () => {
    const result = await start_conversation.execute(
      {
        scope: "project",
        projectId: "project-1",
        openingMessage: "Draft the launch note",
        teammateId: "teammate-1",
      },
      createToolContext("meta"),
    );

    expect(result.data[META_NAVIGATION_DATA_KEY]).toEqual(
      expect.objectContaining({
        kind: "conversation",
        projectId: "project-1",
        workspaceId: "workspace-1",
        openingMessage: "Draft the launch note",
        teammateId: "teammate-1",
      }),
    );
    expect(result.content).toContain("Launch week");
  });

  it("hires a teammate and repeats the permissions sentence", async () => {
    const result = await hire_teammate.execute(
      { roleSlug: "research-analyst" },
      createToolContext("meta"),
    );

    expect(result.data.teammateId).toBe("teammate-1");
    expect(result.content).toContain("waits for your approval");
  });

  it("lists what is waiting on the user", async () => {
    const result = await list_attention.execute({}, createToolContext("meta"));

    expect(result.data.total).toBe(1);
    expect(result.content).toContain("Approve the release note");
    expect(result.content).toContain("Launch week");
  });
});
