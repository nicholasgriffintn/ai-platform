import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationsService } from "./conversations-service.js";

describe("ConversationsService list", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("encodes title search, sorting, archive filter, and pagination in the list request", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        data: {
          conversations: [
            {
              id: "conversation-1",
              title: "Design review",
              messages: ["message-1"],
              created_at: "2026-06-20T10:00:00.000Z",
              updated_at: "2026-06-22T10:00:00.000Z",
              last_message_at: "2026-06-22T10:00:00.000Z",
              is_archived: true,
            },
          ],
          pageNumber: 2,
          pageSize: 30,
          totalPages: 4,
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const service = new ConversationsService(async () => ({}));
    const result = await service.list({
      archived: "archived",
      limit: 30,
      page: 2,
      query: "design review",
      sortBy: "created",
    });

    const [url, request] = fetchMock.mock.calls[0];

    expect(String(url)).toContain(
      "/conversations?limit=30&page=2&archived=archived&sort_by=created&q=design+review",
    );
    expect(request?.method).toBe("GET");
    expect(result.conversations).toEqual([
      expect.objectContaining({
        id: "conversation-1",
        is_archived: true,
        messages: [],
        title: "Design review",
      }),
    ]);
    expect(result.totalPages).toBe(4);
  });

  it("resolves the activity window to an absolute cutoff the API can compare directly", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        data: { conversations: [], pageNumber: 1, pageSize: 25, totalPages: 1 },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const service = new ConversationsService(async () => ({}));

    await service.list({ activity: "today" });

    const requested = new URL(String(fetchMock.mock.calls[0][0]), "https://example.test");
    const cutoff = new Date(requested.searchParams.get("updated_after") as string);
    const startOfToday = new Date();

    startOfToday.setHours(0, 0, 0, 0);

    expect(cutoff.getTime()).toBe(startOfToday.getTime());
  });
});

describe("ConversationsService records", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates conversation items into messages and keeps the latest response", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        data: {
          object: "conversation",
          id: "conversation-1",
          type: "chat",
          title: "Items",
          created_at: "2026-06-20T10:00:00.000Z",
          updated_at: "2026-06-22T10:00:00.000Z",
          is_archived: false,
          user_id: 7,
          share_id: null,
          latest_response: {
            object: "response",
            id: "resp-1",
            conversation_id: "conversation-1",
            status: "completed",
            waiting_on: null,
            attempt: 1,
            trigger: "user",
            initiator_user_id: 7,
            project_id: null,
            project_task_id: null,
            created_at: "2026-06-22T10:00:00.000Z",
            updated_at: "2026-06-22T10:00:01.000Z",
            started_at: "2026-06-22T10:00:00.000Z",
            completed_at: "2026-06-22T10:00:01.000Z",
            terminal_reason: null,
            last_item_id: "m2",
          },
          items: [
            { type: "message", id: "m1", role: "user", content: [{ type: "text", text: "Hi" }] },
            {
              type: "message",
              id: "m2",
              role: "assistant",
              content: [{ type: "text", text: "Hello" }],
              metadata: { model: "gpt", run_id: "resp-1" },
            },
          ],
          has_more_items: true,
          oldest_item_id: "m1",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const service = new ConversationsService(async () => ({}));
    const conversation = await service.get("conversation-1");

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/conversations/conversation-1?refresh_pending=true&item_limit=100",
    );
    expect(conversation.messages.map((message) => [message.role, message.content])).toEqual([
      ["user", "Hi"],
      ["assistant", "Hello"],
    ]);
    expect(conversation.messages[1]).toMatchObject({ model: "gpt", run_id: "resp-1" });
    expect(conversation.latest_response).toMatchObject({ id: "resp-1", status: "completed" });
    expect(conversation.has_more_messages).toBe(true);
    expect(conversation.oldest_message_id).toBe("m1");
  });

  it("sends updated messages as items", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        data: { id: "conversation-1", type: "chat", title: "Renamed", items: [] },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const service = new ConversationsService(async () => ({}));

    await service.update("conversation-1", {
      title: "Renamed",
      messages: [{ id: "m1", role: "user", content: "Hi" }],
    });

    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));

    expect(String(url)).toContain("/conversations/conversation-1");
    expect(request?.method).toBe("PATCH");
    expect(body.title).toBe("Renamed");
    expect(body.messages).toBeUndefined();
    expect(body.items).toEqual([
      expect.objectContaining({
        type: "message",
        id: "m1",
        role: "user",
        content: [{ type: "text", text: "Hi" }],
      }),
    ]);
  });
});
