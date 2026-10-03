import { createManagedAgentSessionSchema } from "@ngriffin_uk/polychat-schemas";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiService } from "./api-service.js";
import {
  createBedrockManagedAgentSession,
  listBedrockManagedAgentItems,
  streamBedrockManagedAgentEvents,
} from "./managed-agents.js";

const input = createManagedAgentSessionSchema.parse({
  agent: { model: "openai.gpt-5.6-luna" },
  environment: {
    type: "aws_bedrock_agentcore",
    runtime_arn: "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/test-runtime",
    workspace_directory: "/home/app/workspace",
  },
  role_arn: "arn:aws:iam::123456789012:role/BmaSession",
});
const session = {
  id: "local-session",
  provider: "bedrock-managed-agents",
  sessionId: "sess_123",
  projectId: "project/1",
  model: input.agent.model,
  environment: input.environment,
  roleArn: input.role_arn,
  status: "waiting",
  deleted: false,
  createdAt: "2026-10-02",
  updatedAt: "2026-10-02",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("managed agent frontend client", () => {
  it("keeps workspace scope on creation and addresses output by the local binding", async () => {
    vi.spyOn(apiService, "getHeaders").mockResolvedValue({ Authorization: "Bearer test-auth" });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ session }))
      .mockResolvedValueOnce(
        Response.json({ data: [], has_more: false, first_id: null, last_id: null }),
      );

    vi.stubGlobal("fetch", fetchMock);
    expect(await createBedrockManagedAgentSession(input, "project/1")).toMatchObject({
      id: "local-session",
      projectId: "project/1",
    });
    const [url, options] = fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toContain("/apps/managed-agents/sessions?projectId=project%2F1");
    expect(JSON.parse(String(options?.body))).toEqual(input);
    expect(new Headers(options?.headers).get("authorization")).toBe("Bearer test-auth");
    await listBedrockManagedAgentItems("local-session", { after: "cursor +/=" });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/sessions/local-session/items?");
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.get("after")).toBe(
      "cursor +/=",
    );
  });

  it("keeps long-lived SSE raw and propagates explicit cancellation", async () => {
    vi.spyOn(apiService, "getHeaders").mockResolvedValue({ Authorization: "Bearer test-auth" });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response('data: {"type":"agent.session.turn.completed"}\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
    const abort = new AbortController();
    const response = await streamBedrockManagedAgentEvents("local-session", abort.signal);
    const init = fetchMock.mock.calls[0]?.[1];

    expect(init?.signal).toBe(abort.signal);
    expect(new Headers(init?.headers).get("accept")).toBe("text/event-stream");
    expect(await response.text()).toContain("turn.completed");
  });
});
