import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { describe, expect, it } from "vitest";

import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { SecretReferenceRepository } from "~/modules/secret-requests/infrastructure/SecretReferenceRepository";

import { submitSecretRequest } from "../secret-requests";

const pendingMessage = {
  id: "message-1",
  role: "tool",
  name: "request_secret",
  status: "pending",
  tool_call_id: "call-1",
  content: "Waiting",
  data: JSON.stringify({
    renderer: "secret_request",
    interactionId: "call-1",
    label: "Example API key",
    purpose: "List invoices",
    destination: "https://api.example.com",
    humanInTheLoop: {
      type: "takeover",
      status: "pending",
      requires_user_action: true,
      interactionId: "call-1",
      toolName: "request_secret",
    },
  }),
};

function createContext(userId: number, runStatus = "awaiting_takeover") {
  const stored: unknown[] = [];
  const fakes = new Map<unknown, unknown>([
    [
      ConversationRunRepository,
      {
        getForInteraction: async () => ({
          conversationId: "conversation-1",
          initiatorUserId: 7,
          status: runStatus,
          lastMessageId: "message-1",
        }),
      },
    ],
    [MessageRepository, { getMessage: async () => pendingMessage }],
    [
      ConversationRepository,
      { getConversation: async () => ({ id: "conversation-1", project_id: null }) },
    ],
    [
      SecretReferenceRepository,
      {
        deleteExpiredForUser: async () => undefined,
        replaceForInteraction: async (record: unknown) => {
          stored.push(record);
        },
      },
    ],
  ]);

  return {
    stored,
    context: {
      env: {
        JWT_SECRET: "test-signing-secret",
        PRIVATE_KEY: bufferToBase64(new Uint8Array(32).fill(3)),
      },
      requireUser: () => ({ id: userId }),
      repositories: { get: (Repository: unknown) => fakes.get(Repository) },
    } as never,
  };
}

describe("submitSecretRequest", () => {
  it("issues a reference for the user who started the waiting run", async () => {
    const { context, stored } = createContext(7);
    const result = await submitSecretRequest(context, "conversation-1", {
      interaction_id: "call-1",
      value: "private-value",
    });

    expect(result).toMatchObject({
      object: "secret_reference",
      label: "Example API key",
      destination: "https://api.example.com",
    });
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain("private-value");
  });

  it("refuses another user or a run that is no longer waiting", async () => {
    for (const { context, stored } of [createContext(8), createContext(7, "running")]) {
      await expect(
        submitSecretRequest(context, "conversation-1", {
          interaction_id: "call-1",
          value: "private-value",
        }),
      ).rejects.toThrow("no longer waiting");
      expect(stored).toHaveLength(0);
    }
  });
});
