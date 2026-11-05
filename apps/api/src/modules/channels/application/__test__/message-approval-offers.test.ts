import {
  POLY_TEAMMATE_ID,
  type ChatRun,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import { ChannelSenderRepository } from "~/modules/channels/infrastructure/ChannelSenderRepository";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IUser } from "~/types";

import { offerRunApprovalByMessage } from "../message-approval-offers";

const mocks = vi.hoisted(() => ({
  issue: vi.fn(),
  sendReply: vi.fn(),
  smsSend: vi.fn(),
  resolveProvider: vi.fn(),
}));

vi.mock("../message-approvals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../message-approvals")>()),
  issueMessageApproval: mocks.issue,
}));
vi.mock("~/modules/channels/infrastructure/adapters", () => ({
  getChannelAdapter: () => ({ isReplyConfigured: () => true, sendReply: mocks.sendReply }),
}));
vi.mock("~/modules/delivery/application/outbound", () => ({
  deliverOutboundOperation: (params: { send(): Promise<void> }) => params.send(),
}));
vi.mock("~/infrastructure/providers/capabilities/messaging/delivery", () => ({
  selectConfiguredMessagingDelivery: () => ({ id: "provider_1", providerId: "twilio-sms" }),
  resolveStoredMessagingProvider: mocks.resolveProvider,
}));

const user = { id: 7 } as IUser;
const run = { id: "run_1", conversationId: "recipe_task_1" } as ChatRun;
const teammateContext = {
  teammateId: POLY_TEAMMATE_ID,
  scope: { type: "personal", id: "7" },
} as TeammateContext;
const polyBinding = {
  id: "binding_1",
  channel: "telegram",
  enabled: true,
  teammate_id: POLY_TEAMMATE_ID,
  scope_type: "personal",
  scope_id: "7",
  external_id: "chat_7",
};

function context(bindings: unknown[], senders: unknown[] = []) {
  return {
    env: {},
    repositories: fakeRepositories([
      [ChannelBindingRepository, { listForUser: async () => bindings }],
      [ChannelSenderRepository, { list: async () => senders }],
      [
        UserSettingsRepository,
        {
          getUserProviderSettings: async () => [],
          getProviderApiKeyForSettings: async () => "encrypted",
        },
      ],
    ]),
  } as unknown as ServiceContext;
}

describe("offerRunApprovalByMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.issue.mockResolvedValue({ id: "mapr_1", body: "Reply APPROVE CODE1234" });
    mocks.resolveProvider.mockReturnValue({
      provider: { send: mocks.smsSend },
      allowedSenders: ["+447700900001"],
    });
  });

  it("offers only to a verified sender on a binding that serves this teammate", async () => {
    await offerRunApprovalByMessage({
      context: context(
        [
          polyBinding,
          { ...polyBinding, id: "binding_off", enabled: false },
          { ...polyBinding, id: "binding_email", channel: "email" },
          { ...polyBinding, id: "binding_other", teammate_id: "teammate_other" },
        ],
        [
          { id: "sender_1", user_id: 7, revision: 2, revoked_at: null },
          { id: "sender_old", user_id: 7, revision: 1, revoked_at: "2026-11-01T00:00:00.000Z" },
          { id: "sender_other", user_id: 8, revision: 1, revoked_at: null },
        ],
      ),
      user,
      teammateContext,
      run,
    });

    expect(mocks.issue).toHaveBeenCalledOnce();
    expect(mocks.sendReply).toHaveBeenCalledOnce();
    expect(mocks.sendReply.mock.calls[0]?.[0]).toMatchObject({ externalId: "chat_7" });
  });

  it("texts a number only when the provider already allows it as a sender", async () => {
    await offerRunApprovalByMessage({
      context: context([]),
      user,
      teammateContext,
      run,
      smsTarget: "+447700900999",
    });

    expect(mocks.issue).not.toHaveBeenCalled();

    await offerRunApprovalByMessage({
      context: context([]),
      user,
      teammateContext,
      run,
      smsTarget: "+447700900001",
    });

    expect(mocks.smsSend).toHaveBeenCalledWith({
      to: "+447700900001",
      body: "Reply APPROVE CODE1234",
    });
  });
});
