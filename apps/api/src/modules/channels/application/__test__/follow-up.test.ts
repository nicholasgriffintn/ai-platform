import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import { ChannelSenderRepository } from "~/modules/channels/infrastructure/ChannelSenderRepository";

import { deliverChannelFollowUp } from "../follow-up";

const sendReply = vi.hoisted(() => vi.fn());

vi.mock("~/modules/channels/infrastructure/adapters", () => ({
  getChannelAdapter: () => ({ label: "Slack", isReplyConfigured: () => true, sendReply }),
}));

vi.mock("~/modules/delivery/application/outbound", () => ({
  deliverOutboundOperation: async (params: { send: () => Promise<void> }) => params.send(),
}));

const binding = {
  id: "binding_1",
  channel: "slack",
  external_id: "T1:C1",
  enabled: true,
  scope_type: "personal",
  scope_id: "42",
};

function createContext(validMapping: boolean): ServiceContext {
  return {
    env: {},
    requireUser: () => ({ id: 42 }),
    repositories: fakeRepositories([
      [ChannelBindingRepository, { getById: async () => binding }],
      [
        ChannelSenderRepository,
        {
          validateMapping: async () => (validMapping ? { id: "mapping_1" } : null),
        },
      ],
    ]),
  } as unknown as ServiceContext;
}

const invocation = {
  source: "channel" as const,
  bindingId: "binding_1",
  messageId: "1700000000.000100",
  senderMappingId: "mapping_1",
  senderRevision: 1,
  threadId: "1700000000.000100",
};

const completion = {
  id: "completion_1",
  object: "chat.completion",
  created: 1,
  model: "test",
  choices: [{ index: 0, message: { role: "assistant", content: "The report is ready." } }],
} as unknown as Parameters<typeof deliverChannelFollowUp>[0]["completion"];

describe("channel follow-up", () => {
  beforeEach(() => {
    sendReply.mockReset();
  });

  it("reports back into the thread the work started from", async () => {
    const result = await deliverChannelFollowUp({
      context: createContext(true),
      invocation,
      operationId: "delegation_wake_run_1",
      completion,
    });

    expect(result).toBe("delivered");
    expect(sendReply).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: "T1:C1",
        threadId: "1700000000.000100",
        inReplyTo: "1700000000.000100",
        body: "The report is ready.",
      }),
      {},
    );
  });

  it("stays silent once the sender is no longer verified", async () => {
    const result = await deliverChannelFollowUp({
      context: createContext(false),
      invocation,
      operationId: "delegation_wake_run_1",
      completion,
    });

    expect(result).toBe("skipped");
    expect(sendReply).not.toHaveBeenCalled();
  });
});
