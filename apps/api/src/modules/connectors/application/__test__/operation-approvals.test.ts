import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  consume: vi.fn(),
  resolve: vi.fn(),
  getByIdForUser: vi.fn(),
}));

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";

import {
  authoriseConnectorOperation,
  resolveConnectorOperationApproval,
} from "../operation-approvals";

function context() {
  return {
    connectorRunId: "connector_run_1",
    repositories: fakeRepositories([
      [
        ConnectorOperationApprovalRepository,
        {
          create: mocks.create,
          consume: mocks.consume,
          resolve: mocks.resolve,
          getByIdForUser: mocks.getByIdForUser,
        },
      ],
      [
        ConversationRunRepository,
        {
          getById: vi.fn(async () => ({
            id: "connector_run_1",
            initiatorUserId: 42,
            conversationId: "completion_1",
            status: "running",
            attempt: 1,
          })),
        },
      ],
    ]),
  } as never;
}

describe("connector operation approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockImplementation(async (input) => ({
      id: "coa_pending",
      ...input,
    }));
  });

  it("fails closed when an approved receipt does not match the exact action", async () => {
    mocks.consume.mockResolvedValueOnce(null);

    await expect(
      authoriseConnectorOperation({
        context: context(),
        userId: 42,
        provider: "gmail",
        operation: "GMAIL_SEND_EMAIL",
        arguments: { recipient: "different@example.com" },
        connectedAccountId: "ca_gmail",
        channel: "web",
        scope: { conversationId: "completion_1", completionId: "completion_1" },
        approvalId: "coa_approved",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("refuses to create a write approval without an account-bound session", async () => {
    await expect(
      authoriseConnectorOperation({
        context: context(),
        userId: 42,
        provider: "gmail",
        operation: "GMAIL_SEND_EMAIL",
        arguments: { recipient: "person@example.com" },
        channel: "web",
        scope: { conversationId: "completion_1", completionId: "completion_1" },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects a conflicting resolution after the receipt is resolved", async () => {
    mocks.resolve.mockResolvedValueOnce(null);
    mocks.getByIdForUser.mockResolvedValueOnce({
      id: "coa_approved",
      userId: 42,
      state: "approved",
      expiresAt: "2099-08-13T12:00:00.000Z",
    });

    await expect(
      resolveConnectorOperationApproval({
        context: context(),
        userId: 42,
        approvalId: "coa_approved",
        resolution: "rejected",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
