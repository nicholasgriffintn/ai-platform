import type { ChatRun, ChatRunCommandReceipt } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { cancelChannelThreadRun } from "~/modules/channels/application/thread-controls";
import { ChatRunLifecycle } from "~/modules/chat-runs/application/lifecycle";

import { channelTestBinding, channelTestThread, channelTestUser } from "./channels";
import { databaseTestEnvironment } from "./environment";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let context: ServiceContext;
const run: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 42,
  trigger: "channel",
  status: "running",
  attempt: 1,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  startedAt: "2026-10-01T00:00:00.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
  resolvedConfiguration: {
    channelDelivery: {
      bindingId: "binding-1",
      thread: {
        workspaceId: "T123",
        externalId: "C123",
        threadId: "171.1",
        revision: 1,
        bindingRevision: 1,
      },
      from: "U9",
    },
  },
};
const receipt: ChatRunCommandReceipt = {
  protocolVersion: 1,
  commandId: "command-1",
  run,
  kind: "turn",
  acceptedAt: run.createdAt,
  duplicate: false,
};

beforeAll(async () => {
  context = createServiceContext({
    env: databaseTestEnvironment(await runtime.getD1Database("DB")),
    user: channelTestUser,
  });
});
afterAll(() => runtime.dispose());
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(context.repositories.channelBindings, "getById").mockResolvedValue(channelTestBinding);
  vi.spyOn(context.repositories.channelThreads, "get").mockResolvedValue(channelTestThread);
  vi.spyOn(context.repositories.conversationRuns, "getById").mockResolvedValue(run);
});

it("observes a stop accepted before the run's cancellation receipt exists", async () => {
  const lifecycle = new ChatRunLifecycle(
    context.repositories.conversationRuns,
    receipt,
    context.env,
    context,
  );

  expect(await lifecycle.isCancellationRequested()).toBe(false);
  vi.mocked(context.repositories.channelThreads.get).mockResolvedValue({
    ...channelTestThread,
    revision: 2,
  });
  expect(await lifecycle.isCancellationRequested()).toBe(true);
});

it("stops an admitted run when its binding or sender authority is revoked", async () => {
  const lifecycle = new ChatRunLifecycle(
    context.repositories.conversationRuns,
    receipt,
    context.env,
    context,
  );

  vi.mocked(context.repositories.channelBindings.getById).mockResolvedValue({
    ...channelTestBinding,
    allowed_sender_ids: '["U42"]',
  });
  expect(await lifecycle.isCancellationRequested()).toBe(true);
  vi.mocked(context.repositories.channelBindings.getById).mockResolvedValue(null);
  expect(await lifecycle.isCancellationRequested()).toBe(true);
});

it("does not cancel a newer run when Slack retries an earlier stop command", async () => {
  const newRun = {
    ...run,
    resolvedConfiguration: {
      channelDelivery: {
        bindingId: "binding-1",
        thread: {
          workspaceId: "T123",
          externalId: "C123",
          threadId: "171.1",
          revision: 2,
          bindingRevision: 1,
        },
        from: "U9",
      },
    },
  };

  vi.spyOn(context.repositories.conversationRuns, "getLatestForConversation").mockResolvedValue(
    newRun,
  );
  const cancel = vi.spyOn(context.repositories.conversationRuns, "acceptCancellation");

  await cancelChannelThreadRun({
    context,
    conversationId: run.conversationId,
    userId: 42,
    revision: 2,
  });

  expect(cancel).not.toHaveBeenCalled();
});
