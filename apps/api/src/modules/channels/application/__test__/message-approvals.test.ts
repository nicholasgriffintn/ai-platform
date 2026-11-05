import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import type { MessageApprovalRow } from "~/infrastructure/database/schema";
import { MessageApprovalRepository } from "~/modules/channels/infrastructure/MessageApprovalRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import type { IUser } from "~/types";

import {
  answerMessageApproval,
  issueMessageApproval,
  type MessageApprovalSender,
} from "../message-approvals";
import "~/tools";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  conversationGet: vi.fn(async () => [{ role: "user", content: "start" }]),
}));

vi.mock("~/modules/responses/application/prepare", () => ({
  prepareConversationCompletion: mocks.prepare,
}));
vi.mock("~/modules/conversations/application/manager", () => ({
  ConversationManager: { getInstance: () => ({ get: mocks.conversationGet }) },
}));

const user = { id: 7 } as IUser;
const sender: MessageApprovalSender = { channel: "telegram", senderKey: "sender-key" };
const CREDENTIAL_TOOL = "connect_trakt";
const postArguments = { url: "https://api.example.com/tickets", method: "POST" };

const run = {
  id: "run_1",
  attempt: 1,
  conversationId: "recipe_task_1",
  initiatorUserId: 7,
  status: "awaiting_approval",
  interactionKind: "approval",
  lastMessageId: "message_pending",
  resolvedConfiguration: {
    teammateId: "poly",
    behaviour: "colleague",
    persona: {},
    model: "model",
    mode: "agent",
    skillIds: [],
    enabledTools: [],
    memoryBindings: [],
    mcpServers: [],
    connectionGrants: [],
    maxSteps: 8,
    usedSteps: 1,
  },
} as unknown as ChatRun;

function pendingMessage(args: unknown = postArguments, name = "call_api") {
  return {
    message: {
      role: "tool",
      status: "pending",
      name,
      tool_call_id: "call_1",
      tool_call_arguments: JSON.stringify(args),
      data: { approvalRequired: true, options: ["Approve", "Reject"] },
    },
    conversation_id: run.conversationId,
    user_id: 7,
  };
}

function harness(
  overrides: {
    stored?: ReturnType<typeof pendingMessage>;
    pendingCalls?: number;
    run?: ChatRun;
    row?: Partial<MessageApprovalRow> | null;
    claim?: MessageApprovalRow | null;
  } = {},
) {
  const created: { value: MessageApprovalRow | null } = { value: null };
  const claim = vi.fn(async () =>
    overrides.claim === undefined ? (created.value ?? ({} as MessageApprovalRow)) : overrides.claim,
  );
  const create = vi.fn(async (input: Record<string, unknown>) => {
    created.value = {
      id: "mapr_1",
      user_id: input.userId,
      run_id: input.runId,
      run_attempt: input.runAttempt,
      conversation_id: input.conversationId,
      interaction_id: input.interactionId,
      tool_name: input.toolName,
      connector_approval_id: input.connectorApprovalId,
      argument_digest: input.argumentDigest,
      effect_class: input.effectClass,
      channel: input.channel,
      sender_key: input.senderKey,
      code_hash: input.codeHash,
      state: "pending",
      expires_at: input.expiresAt,
      resolved_message_id: null,
      resolved_at: null,
      created_at: "2026-11-05T09:00:00.000Z",
    } as MessageApprovalRow;

    return created.value;
  });
  const context = {
    env: {},
    getLogger: () => ({ warn: vi.fn() }),
    repositories: fakeRepositories([
      [
        MessageRepository,
        {
          listPendingToolCallsForRuns: async () =>
            Array.from({ length: overrides.pendingCalls ?? 1 }, () => ({ run_id: run.id })),
          getMessageById: async () => overrides.stored ?? pendingMessage(),
        },
      ],
      [ConversationRunRepository, { getById: async () => overrides.run ?? run }],
      [
        MessageApprovalRepository,
        {
          create,
          claim,
          getByCode: async () =>
            overrides.row === null
              ? null
              : created.value
                ? { ...created.value, ...overrides.row }
                : null,
        },
      ],
    ]),
  } as unknown as ServiceContext;

  return { context, create, claim, created };
}

async function issueCode(context: ServiceContext) {
  const issued = await issueMessageApproval({ context, user, run, sender });

  return /APPROVE (\S+)/.exec(issued?.body ?? "")?.[1] ?? "";
}

function answer(
  context: ServiceContext,
  code: string,
  from: MessageApprovalSender = sender,
  resolution?: "rejected",
) {
  return answerMessageApproval({
    context,
    user,
    sender: from,
    reply: { resolution: resolution ?? "approved", code },
    messageId: "inbound_1",
  });
}

describe("message approvals", () => {
  beforeEach(() => {
    mocks.prepare.mockReset();
    mocks.prepare.mockResolvedValue({ choices: [], run: undefined });
  });

  it("stores only a hash of the code and binds it to the call and its arguments", async () => {
    const { context, create } = harness();
    const code = await issueCode(context);
    const stored = create.mock.calls[0]?.[0];

    expect(code).toMatch(/^[0-9A-Z]{8}$/);
    expect(stored).toMatchObject({
      runId: "run_1",
      interactionId: "call_1",
      toolName: "call_api",
      channel: "telegram",
      senderKey: "sender-key",
      codeHash: await sha256Hex(code),
    });
    expect(JSON.stringify(stored)).not.toContain(code);
    expect(Date.parse(String(stored?.expiresAt))).toBeGreaterThan(Date.now());
  });

  it("resumes the exact pending call for the verified sender", async () => {
    const { context, claim } = harness();
    const code = await issueCode(context);

    await expect(answer(context, code)).resolves.toMatchObject({
      status: "resolved",
      body: "Approved.",
    });
    expect(claim).toHaveBeenCalledOnce();
    expect(mocks.prepare.mock.calls[0]?.[0].request).toMatchObject({
      conversationId: "recipe_task_1",
      commandId: "message_approval_mapr_1",
      settings: {
        options: {
          toolInteraction: {
            toolName: "call_api",
            response: {
              interactionId: "call_1",
              resolution: "approved",
              option: "Approve",
              approvalRequired: true,
            },
          },
        },
      },
    });
  });

  it("carries a rejection back to the run", async () => {
    const { context } = harness();
    const code = await issueCode(context);

    await answer(context, code, sender, "rejected");

    expect(mocks.prepare.mock.calls[0]?.[0].request.settings.options.toolInteraction).toMatchObject(
      { response: { resolution: "rejected", option: "Reject" } },
    );
  });

  it("refuses another sender, even with the right code", async () => {
    const { context, claim } = harness();
    const code = await issueCode(context);

    await expect(
      answer(context, code, { channel: "telegram", senderKey: "someone-else" }),
    ).resolves.toMatchObject({ status: "invalid" });
    await expect(
      answer(context, code, { channel: "slack", senderKey: "sender-key" }),
    ).resolves.toMatchObject({ status: "invalid" });
    expect(claim).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("refuses when the pending call's arguments have changed since the code was sent", async () => {
    const original = harness();
    const code = await issueCode(original.context);
    const stored = original.created.value;
    const changed = harness({
      stored: pendingMessage({ ...postArguments, url: "https://api.example.com/other" }),
      row: stored,
    });

    changed.created.value = stored;

    await expect(answer(changed.context, code)).resolves.toMatchObject({ status: "invalid" });
    expect(changed.claim).not.toHaveBeenCalled();
  });

  it("refuses an expired code", async () => {
    const original = harness();
    const code = await issueCode(original.context);
    const expired = harness({
      row: { ...original.created.value, expires_at: "2020-01-01T00:00:00.000Z" },
    });

    expired.created.value = original.created.value;

    await expect(answer(expired.context, code)).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("does not resume when another reply already claimed the code", async () => {
    const { context } = harness({ claim: null });
    const code = await issueCode(context);

    await expect(answer(context, code)).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("refuses a code that was already answered by a different message", async () => {
    const original = harness();
    const code = await issueCode(original.context);
    const spent = harness({
      row: { ...original.created.value, state: "approved", resolved_message_id: "inbound_0" },
    });

    spent.created.value = original.created.value;

    await expect(answer(spent.context, code)).resolves.toMatchObject({ status: "invalid" });
    expect(spent.claim).not.toHaveBeenCalled();
  });

  it("offers a floor effect once, but keeps credential handling in the app", async () => {
    const send = harness({
      stored: pendingMessage({ url: "https://api.example.com/1", method: "DELETE" }),
    });

    await expect(issueCode(send.context)).resolves.toMatch(/^[0-9A-Z]{8}$/);

    const credential = harness({ stored: pendingMessage({}, CREDENTIAL_TOOL) });

    await expect(
      issueMessageApproval({ context: credential.context, user, run, sender }),
    ).resolves.toBeNull();
    expect(credential.create).not.toHaveBeenCalled();
  });

  it("leaves several waiting calls to the app, where they can be decided together", async () => {
    const { context, create } = harness({ pendingCalls: 2 });

    await expect(issueMessageApproval({ context, user, run, sender })).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
