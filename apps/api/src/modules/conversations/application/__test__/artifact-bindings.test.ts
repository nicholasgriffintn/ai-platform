import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireConversationAccess: vi.fn(),
  executeRecipeConnectorOperation: vi.fn(),
}));

vi.mock("../access", () => ({
  requireConversationAccess: mocks.requireConversationAccess,
}));

vi.mock("~/modules/apps/application/connectors/operations", () => ({
  executeRecipeConnectorOperation: mocks.executeRecipeConnectorOperation,
}));

import { readArtifactBinding } from "../artifact-bindings";

function artifactMessage(bindings: unknown[]) {
  return [
    "Here is your dashboard.",
    '<artifact identifier="sessions" type="application/vnd.react" title="Sessions">',
    `<bindings>${JSON.stringify(bindings)}</bindings>`,
    "export default function Sessions() { return null; }",
    "</artifact>",
  ].join("\n");
}

function createContext(content: string, conversationId = "conversation-1") {
  return {
    requireUser: () => ({ id: 7 }),
    env: {},
    repositories: {
      messages: {
        getMessageById: vi.fn(async () => ({
          conversation_id: conversationId,
          user_id: 7,
          message: { role: "assistant", content },
        })),
      },
    },
  } as never;
}

const request = {
  messageId: "message-1",
  artifactIdentifier: "sessions",
  bindingId: "sessions",
};

describe("readArtifactBinding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeRecipeConnectorOperation.mockResolvedValue([{ id: "session-1" }]);
  });

  it("runs the read the artifact declared in its stored message", async () => {
    const context = createContext(
      artifactMessage([
        {
          id: "sessions",
          provider: "devin",
          operation: "list_sessions",
          args: { organizationId: "org-1" },
        },
      ]),
    );

    const result = await readArtifactBinding(context, "conversation-1", request);

    expect(result.data).toEqual([{ id: "session-1" }]);
    expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          provider: "devin",
          operation: "list_sessions",
          params: { organizationId: "org-1" },
        },
      }),
    );
  });

  it("refuses a declared operation that would change something", async () => {
    const context = createContext(
      artifactMessage([
        {
          id: "sessions",
          provider: "devin",
          operation: "create_session",
          args: { organizationId: "org-1", prompt: "hi" },
        },
      ]),
    );

    await expect(readArtifactBinding(context, "conversation-1", request)).rejects.toThrow(
      "can only read",
    );
    expect(mocks.executeRecipeConnectorOperation).not.toHaveBeenCalled();
  });

  it("refuses arguments the artifact did not declare", async () => {
    const context = createContext(
      artifactMessage([
        {
          id: "sessions",
          provider: "devin",
          operation: "list_sessions",
          args: { organizationId: "org-1" },
        },
      ]),
    );

    await expect(
      readArtifactBinding(context, "conversation-1", { ...request, args: { sessionId: "other" } }),
    ).rejects.toThrow("not one of this data source's declared arguments");
    expect(mocks.executeRecipeConnectorOperation).not.toHaveBeenCalled();
  });

  it("will not read a message from another conversation", async () => {
    const context = createContext(
      artifactMessage([
        {
          id: "sessions",
          provider: "devin",
          operation: "list_sessions",
          args: { organizationId: "org-1" },
        },
      ]),
      "conversation-2",
    );

    await expect(readArtifactBinding(context, "conversation-1", request)).rejects.toThrow(
      "not available",
    );
  });
});
