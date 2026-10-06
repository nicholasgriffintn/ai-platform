import { POLY_TEAMMATE_ID } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChannelBindingRow } from "~/infrastructure/database/schema";
import type { IUser } from "~/types";

import { sendPolyNotificationToChannels } from "../channel-delivery";

const mocks = vi.hoisted(() => ({
  sendReply: vi.fn(),
  deliver: vi.fn(),
}));

vi.mock("~/modules/channels/infrastructure/adapters", () => ({
  getChannelAdapter: () => ({ sendReply: mocks.sendReply }),
}));
vi.mock("~/modules/delivery/application/outbound", () => ({
  deliverOutboundOperation: mocks.deliver,
}));

function binding(overrides: Partial<ChannelBindingRow>): ChannelBindingRow {
  return {
    id: "binding_telegram",
    channel: "telegram",
    scope_type: "personal",
    scope_id: "7",
    external_id: "chat_7",
    label: null,
    teammate_id: POLY_TEAMMATE_ID,
    interaction_mode: "direct",
    created_by: 7,
    enabled: true,
    created_at: "2026-10-06T09:00:00.000Z",
    ...overrides,
  };
}

function context(bindings: ChannelBindingRow[]) {
  return {
    env: { TELEGRAM_BOT_TOKEN: "telegram-secret", SLACK_BOT_TOKEN: "slack-secret" },
    repositories: { channelBindings: { listForUser: async () => bindings } },
  } as unknown as ServiceContext;
}

describe("sendPolyNotificationToChannels", () => {
  beforeEach(() => {
    mocks.sendReply.mockReset();
    mocks.deliver.mockReset();
    mocks.deliver.mockImplementation(async ({ send }: { send: () => Promise<void> }) => send());
  });

  it("reaches only the person's own enabled Poly bindings, at the top of the chat", async () => {
    await sendPolyNotificationToChannels({
      context: context([
        binding({}),
        binding({ id: "binding_other_teammate", teammate_id: "platform-research" }),
        binding({ id: "binding_disabled", enabled: false }),
        binding({ id: "binding_project", scope_type: "project", scope_id: "project_1" }),
        binding({ id: "binding_someone_else", created_by: 9 }),
      ]),
      user: { id: 7 } as IUser,
      polyContextId: "teammate_context_poly",
      notificationId: "routine_result_1",
      body: "Routine needs attention: Invoices",
    });

    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    expect(mocks.sendReply).toHaveBeenCalledWith(
      { externalId: "chat_7", body: "Routine needs attention: Invoices", threadId: "direct" },
      expect.any(String),
    );
  });

  it("keeps going when one channel fails", async () => {
    mocks.deliver.mockRejectedValueOnce(new Error("Telegram rejected the reply"));

    await sendPolyNotificationToChannels({
      context: context([binding({}), binding({ id: "binding_second", external_id: "chat_8" })]),
      user: { id: 7 } as IUser,
      polyContextId: "teammate_context_poly",
      notificationId: "routine_result_1",
      body: "Routine failed: Inbox sweep",
    });

    expect(mocks.deliver).toHaveBeenCalledTimes(2);
  });
});
