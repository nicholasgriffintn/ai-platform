import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  consume: vi.fn(),
  resolve: vi.fn(),
  getByIdForUser: vi.fn(),
}));

import {
  authoriseConnectorOperation,
  getConnectorOperationApproval,
  getConnectorArgumentDigest,
  resolveConnectorOperationApproval,
} from "../operation-approvals";

function context() {
  return {
    connectorRunId: "connector_run_1",
    repositories: {
      connectorOperationApprovals: {
        create: mocks.create,
        consume: mocks.consume,
        resolve: mocks.resolve,
        getByIdForUser: mocks.getByIdForUser,
      },
    },
  } as never;
}

describe("connector operation approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockImplementation(async (input) => ({ id: "coa_pending", ...input }));
  });

  it("binds equivalent argument objects to the same canonical digest", async () => {
    const first = await getConnectorArgumentDigest({
      provider: "gmail",
      operation: "GMAIL_SEND_EMAIL",
      arguments: { recipient: "person@example.com", body: { z: 2, a: 1 } },
    });
    const second = await getConnectorArgumentDigest({
      operation: "GMAIL_SEND_EMAIL",
      arguments: { body: { a: 1, z: 2 }, recipient: "person@example.com" },
      provider: "gmail",
    });

    expect(first).toBe(second);
  });

  it("creates an expiring action-bound receipt before a write can execute", async () => {
    const decision = await authoriseConnectorOperation({
      context: context(),
      userId: 42,
      provider: "gmail",
      operation: "GMAIL_SEND_EMAIL",
      arguments: { recipient: "person@example.com" },
      connectedAccountId: "ca_gmail",
      channel: "web",
      scope: { completionId: "completion_1", recipeId: "recipe_1" },
    });

    expect(decision).toMatchObject({ required: true, approved: false });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        runId: "connector_run_1",
        completionId: "completion_1",
        provider: "gmail",
        operation: "GMAIL_SEND_EMAIL",
        connectedAccountId: "ca_gmail",
        channel: "web",
        argumentDigest: expect.any(String),
        expiresAt: expect.any(String),
      }),
    );
    expect(mocks.consume).not.toHaveBeenCalled();
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
        scope: { completionId: "completion_1" },
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
        scope: { completionId: "completion_1" },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns the existing receipt when the same resolution is retried", async () => {
    const existing = {
      id: "coa_approved",
      userId: 42,
      state: "approved",
      expiresAt: "2099-08-13T12:00:00.000Z",
      resolvedAt: "2026-08-13T12:00:00.000Z",
      consumedAt: null,
    };

    mocks.resolve.mockResolvedValueOnce(null);
    mocks.getByIdForUser.mockResolvedValueOnce(existing);

    await expect(
      resolveConnectorOperationApproval({
        context: context(),
        userId: 42,
        approvalId: "coa_approved",
        resolution: "approved",
      }),
    ).resolves.toEqual({
      id: "coa_approved",
      state: "approved",
      expiresAt: "2099-08-13T12:00:00.000Z",
      resolvedAt: "2026-08-13T12:00:00.000Z",
      consumedAt: null,
    });
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

  it("returns owner-scoped authoritative state and projects expiry", async () => {
    mocks.getByIdForUser.mockResolvedValueOnce({
      id: "coa_pending",
      userId: 42,
      runId: "run-1",
      completionId: "conversation-1",
      provider: "gmail",
      operation: "GMAIL_SEND_EMAIL",
      connectedAccountId: "ca_gmail",
      channel: "web",
      argumentDigest: "digest",
      state: "pending",
      createdAt: "2026-09-05T12:00:00.000Z",
      expiresAt: "2026-09-05T12:10:00.000Z",
      resolvedAt: null,
      consumedAt: null,
    });

    await expect(
      getConnectorOperationApproval({
        context: context(),
        userId: 42,
        approvalId: "coa_pending",
        now: "2026-09-05T12:11:00.000Z",
      }),
    ).resolves.toMatchObject({
      id: "coa_pending",
      runId: "run-1",
      state: "expired",
    });
    expect(mocks.getByIdForUser).toHaveBeenCalledWith("coa_pending", 42);
  });

  it("does not expose another user's connector approval", async () => {
    mocks.getByIdForUser.mockResolvedValueOnce(null);

    await expect(
      getConnectorOperationApproval({
        context: context(),
        userId: 7,
        approvalId: "coa_other",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
