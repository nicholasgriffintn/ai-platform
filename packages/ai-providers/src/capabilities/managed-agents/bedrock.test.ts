import { createManagedAgentSessionSchema } from "@ngriffin_uk/polychat-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseAwsSessionCredentials } from "../../utils/awsCredentials.js";
import { BedrockManagedAgentsClient } from "./bedrock.js";

const input = createManagedAgentSessionSchema.parse({
  agent: { model: "openai.gpt-5.6-luna", instructions: "Inspect the workspace" },
  environment: {
    type: "aws_bedrock_agentcore",
    runtime_arn: "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/test-runtime",
    workspace_directory: "/home/app/workspace",
  },
  role_arn: "arn:aws:iam::123456789012:role/BmaSession",
});
const session = { id: "sess_123", status: "idle", ...input };
const credentials = vi.fn(async () => ({
  accessKey: "test-access",
  secretKey: "test-secret",
  sessionToken: "test-session-token",
}));
const fetchMock = vi.fn<typeof fetch>();
let client: BedrockManagedAgentsClient;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  credentials.mockResolvedValue({
    accessKey: "test-access",
    secretKey: "test-secret",
    sessionToken: "test-session-token",
  });
  vi.stubGlobal("fetch", fetchMock);
  client = new BedrockManagedAgentsClient({ region: "us-east-1", credentials });
});
afterEach(() => vi.unstubAllGlobals());

async function sentRequest() {
  const value = fetchMock.mock.calls.at(-1)?.[0];

  if (!(value instanceof Request)) {
    throw new Error("Expected a signed request");
  }

  return value;
}

describe("Bedrock Managed Agents", () => {
  it("signs for Mantle with temporary credentials and sends only the documented session shape", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        ...session,
        environment: { ...session.environment, id: "env_123", status: "connected" },
      }),
    );
    expect((await client.createSession(input)).environment).toEqual(input.environment);
    const request = await sentRequest();

    expect(request.url).toBe("https://bedrock-mantle.us-east-1.api.aws/openai/v1/agents/sessions");
    expect(request.headers.get("authorization")).toMatch(
      /Credential=test-access\/.*\/us-east-1\/bedrock-mantle\/aws4_request/,
    );
    expect(request.headers.get("x-amz-security-token")).toBe("test-session-token");
    expect(request.redirect).toBe("error");
    expect(await request.json()).toEqual({ ...input, stream: false });
  });

  it("re-resolves credentials for each request and encodes opaque session identifiers", async () => {
    fetchMock.mockImplementation(async () => Response.json(session));
    await client.retrieveSession("sess_/one?");
    credentials.mockResolvedValueOnce({
      accessKey: "rotated-access",
      secretKey: "rotated-secret",
      sessionToken: "rotated-token",
    });
    await client.retrieveSession("sess_/one?");
    const request = await sentRequest();

    expect(request.url).toContain("/sessions/sess_%2Fone%3F");
    expect(request.headers.get("authorization")).toContain("Credential=rotated-access/");
    expect(credentials).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported fields, account mismatch and endpoint mismatch before spend", async () => {
    await expect(
      client.createSession({
        ...input,
        environment: {
          ...input.environment,
          runtime_arn: input.environment.runtime_arn.replace("us-east-1", "us-west-2"),
        },
      }),
    ).rejects.toThrow("regions must match");
    await expect(
      client.createSession({ ...input, role_arn: "arn:aws:iam::999999999999:role/Other" }),
    ).rejects.toThrow("same AWS account");
    expect(
      createManagedAgentSessionSchema.safeParse({
        ...input,
        environment: { ...input.environment, env: { SECRET: "never-send" } },
      }).success,
    ).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits messages and cancellations without decoding an empty acknowledgement", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    await client.sendMessage("sess_123", "Continue");
    expect(await (await sentRequest()).json()).toEqual({
      events: [
        {
          type: "agent.session.input.message",
          input: [{ role: "user", content: [{ type: "input_text", text: "Continue" }] }],
        },
      ],
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    await client.cancelTurn("sess_123");
    expect(await (await sentRequest()).json()).toEqual({
      events: [{ type: "agent.session.input.cancel" }],
    });
  });

  it("streams SSE with explicit stream=true and propagates caller cancellation", async () => {
    const controller = new AbortController();

    fetchMock.mockResolvedValueOnce(
      new Response('data: {"type":"agent.session.turn.completed"}\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const response = await client.streamEvents("sess_123", controller.signal);
    const request = await sentRequest();

    expect(request.url.endsWith("/sess_123/events?stream=true")).toBe(true);
    expect(request.headers.get("accept")).toBe("text/event-stream");
    controller.abort();
    expect(request.signal.aborted).toBe(true);
    expect(await response.text()).toContain("turn.completed");
  });

  it("preserves item data and encodes opaque pagination cursors", async () => {
    const page = {
      data: [
        {
          id: "item_1",
          type: "command_execution",
          turn_id: "turn_1",
          command: "pwd",
          exit_code: 0,
        },
      ],
      has_more: false,
      first_id: "item_1",
      last_id: "item_1",
    };

    fetchMock.mockResolvedValueOnce(Response.json(page));
    expect(
      await client.listItems("sess_123", { limit: 100, after: "opaque+/= cursor", order: "asc" }),
    ).toEqual(page);
    expect(new URL((await sentRequest()).url).searchParams.get("after")).toBe("opaque+/= cursor");
  });

  it("rejects an invalid stream and malformed JSON without leaking upstream text", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("test-secret", { headers: { "Content-Type": "application/json" } }),
    );
    await expect(client.streamEvents("sess_123")).rejects.toThrow("did not return an event stream");
    fetchMock.mockResolvedValueOnce(new Response("test-secret"));
    await expect(client.retrieveSession("sess_123")).rejects.toThrow("unsupported response");
  });

  it("does not retry ambiguous writes or expose upstream error bodies", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Authorization: test-secret", {
        status: 403,
        headers: { "x-amzn-requestid": "req-1" },
      }),
    );
    await expect(client.createSession(input)).rejects.toMatchObject({
      message: "Bedrock Managed Agents request failed (403)",
      statusCode: 403,
      context: { requestId: "req-1" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("makes deletion idempotent for missing sessions and reports conflicts", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(client.deleteSession("sess_123")).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }));
    await expect(client.deleteSession("sess_123")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("accepts optional session tokens and rejects malformed credentials", () => {
    expect(parseAwsSessionCredentials("access::@@::secret::@@::token")).toEqual({
      accessKey: "access",
      secretKey: "secret",
      sessionToken: "token",
    });
    expect(parseAwsSessionCredentials("access::@@::secret")).toEqual({
      accessKey: "access",
      secretKey: "secret",
    });
    expect(() => parseAwsSessionCredentials("access::@@::secret::@@::")).toThrow(
      "Invalid AWS credentials",
    );
    expect(() => parseAwsSessionCredentials("access::@@::secret::@@::token::@@::extra")).toThrow(
      "Invalid AWS credentials",
    );
  });
});
