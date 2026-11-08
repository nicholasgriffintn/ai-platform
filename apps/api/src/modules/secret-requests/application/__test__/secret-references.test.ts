import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import {
  SecretReferenceRepository,
  type SecretReferenceRecord,
  type SecretReferenceRedemption,
} from "~/modules/secret-requests/infrastructure/SecretReferenceRepository";
import { call_api } from "~/modules/tools/application/builtin/api_call";

import { issueSecretReference, redeemSecretReference } from "../secret-references";

const SECRET = "sk_live_private_value_1234567890";

function createContext(conversations: Record<string, string | null> = {}) {
  const rows = new Map<string, SecretReferenceRecord>();
  const secretReferences = {
    rows,
    async replaceForInteraction(record: SecretReferenceRecord) {
      for (const [id, row] of rows) {
        if (
          row.conversation_id === record.conversation_id &&
          row.interaction_id === record.interaction_id
        ) {
          rows.delete(id);
        }
      }

      rows.set(record.id, record);
    },
    async findByHash(hash: string) {
      return [...rows.values()].find((row) => row.reference_hash === hash) ?? null;
    },
    async consume(params: SecretReferenceRedemption) {
      const row = rows.get(params.id);

      if (
        !row ||
        row.user_id !== params.userId ||
        row.project_id !== params.projectId ||
        row.conversation_id !== params.conversationId ||
        row.expires_at <= params.now
      ) {
        return null;
      }

      rows.delete(params.id);

      return row;
    },
    async deleteExpiredForUser() {},
  };
  const conversationRepository = {
    async getConversation(id: string) {
      return id in conversations ? { id, project_id: conversations[id] } : null;
    },
  };
  const fakes = new Map<unknown, unknown>([
    [SecretReferenceRepository, secretReferences],
    [ConversationRepository, conversationRepository],
  ]);

  return {
    rows,
    context: {
      env: {
        JWT_SECRET: "test-signing-secret",
        PRIVATE_KEY: bufferToBase64(new Uint8Array(32).fill(7)),
      },
      repositories: { get: (Repository: unknown) => fakes.get(Repository) },
    } as never,
  };
}

const binding = { userId: 7, projectId: null, conversationId: "conversation-1" };

async function issue(context: never, destination: string | null = "https://api.example.com") {
  return issueSecretReference(context, {
    ...binding,
    interactionId: "call-1",
    label: "Example API key",
    destination,
    value: SECRET,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("secret references", () => {
  it("redeems once for the bound user and conversation and stores only the sealed value", async () => {
    const { context, rows } = createContext();
    const { reference } = await issue(context);

    expect(reference).toMatch(/^secret-ref:[a-f0-9]{64}$/);
    expect(JSON.stringify([...rows.values()])).not.toContain(SECRET);

    const redeemed = await redeemSecretReference(context, {
      ...binding,
      reference,
      destination: "https://api.example.com/v1/charges",
    });

    expect(redeemed.value).toBe(SECRET);
    await expect(
      redeemSecretReference(context, {
        ...binding,
        reference,
        destination: "https://api.example.com/v1/charges",
      }),
    ).rejects.toThrow(/already used/);
  });

  it("refuses another user, conversation or scope without spending the reference", async () => {
    const { context } = createContext();
    const { reference } = await issue(context);
    const destination = "https://api.example.com";

    for (const other of [
      { ...binding, userId: 8 },
      { ...binding, conversationId: "conversation-2" },
      { ...binding, projectId: "project-1" },
    ]) {
      await expect(
        redeemSecretReference(context, { ...other, reference, destination }),
      ).rejects.toThrow(/another conversation/);
    }

    await expect(
      redeemSecretReference(context, { ...binding, reference, destination }),
    ).resolves.toMatchObject({ value: SECRET });
  });

  it("refuses an expired reference", async () => {
    const { context } = createContext();
    const { reference } = await issue(context);

    await expect(
      redeemSecretReference(context, {
        ...binding,
        reference,
        destination: "https://api.example.com",
        now: new Date(Date.now() + 25 * 60 * 60 * 1000),
      }),
    ).rejects.toThrow(/expired/);
  });

  it("refuses a destination the user did not see", async () => {
    const { context } = createContext();
    const { reference } = await issue(context);

    await expect(
      redeemSecretReference(context, {
        ...binding,
        reference,
        destination: "https://attacker.example.net/collect",
      }),
    ).rejects.toThrow("This secret can only be sent to https://api.example.com.");
  });
});

describe("call_api with a secret reference", () => {
  it("sends the secret to the destination and keeps it out of the tool output", async () => {
    const { context } = createContext({ "conversation-1": null });
    const { reference } = await issue(context);
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const authorization = new Headers(init.headers).get("authorization") ?? "";

      return new Response(JSON.stringify({ echoed: authorization }), {
        status: 200,
        headers: { "content-type": "application/json", "x-echo": authorization },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await call_api.execute(
      { url: "https://api.example.com/v1/me", auth: { secret_ref: reference } },
      Object.assign(Object.create(null), {
        completionId: "conversation-1",
        toolCallId: "call-2",
        request: { user: { id: 7 }, context },
      }),
    );

    expect(new Headers(fetchMock.mock.calls[0]?.[1].headers).get("authorization")).toBe(
      `Bearer ${SECRET}`,
    );
    expect(result.status).toBe("success");
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});
