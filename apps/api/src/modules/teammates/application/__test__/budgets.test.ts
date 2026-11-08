import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import {
  WorkspaceTeammateRepository,
  type WorkspaceTeammateRecord,
} from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { setReportBudget } from "../budgets";
import { managesTeammate, readTeammateSpendByWorkspace } from "../organisation";

vi.mock("../organisation", () => ({
  managesTeammate: vi.fn(),
  readTeammateSpendByWorkspace: vi.fn(),
}));

const CREDIT = 1_000_000;

function employment(overrides: Partial<WorkspaceTeammateRecord> = {}): WorkspaceTeammateRecord {
  return {
    workspaceId: "ws",
    teammateId: "mara",
    title: "Copywriter",
    reportsToTeammateId: "atlas",
    status: "active",
    pausedReason: null,
    responsibleUserId: 7,
    heartbeatMinutes: null,
    lastHeartbeatAt: null,
    lastWake: null,
    monthlyCreditCapMicros: 20 * CREDIT,
    budgetWarnedPeriod: null,
    budgetAlertAt: null,
    projectIds: ["web"],
    proposal: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function createContext(params: {
  record: WorkspaceTeammateRecord;
  teammateSpend: number;
  workspaceCap?: number | null;
  workspaceSpend?: number;
}) {
  const update = vi.fn(
    async (
      _workspaceId: string,
      _teammateId: string,
      updates: Partial<WorkspaceTeammateRecord>,
    ) => ({
      ...params.record,
      ...updates,
    }),
  );

  vi.mocked(readTeammateSpendByWorkspace).mockResolvedValue(
    new Map([[params.record.teammateId, params.teammateSpend]]),
  );

  const context = Object.assign(Object.create(null), {
    requireUser: vi.fn().mockReturnValue({ id: 7 }),
    repositories: fakeRepositories([
      [WorkspaceTeammateRepository, { get: vi.fn(async () => params.record), update }],
      [
        WorkspaceRepository,
        {
          getWorkspace: vi.fn(async () => ({
            id: "ws",
            monthly_credit_cap_micros: params.workspaceCap ?? null,
          })),
        },
      ],
      [
        UsageEventRepository,
        {
          summariseWorkspaceSpend: vi.fn(async () => [
            { group_id: "web", credit_micros: params.workspaceSpend ?? 0 },
          ]),
        },
      ],
      [AuditRepository, { createRecord: vi.fn() }],
    ]),
  });

  return { context, update };
}

describe("setReportBudget", () => {
  beforeEach(() => {
    vi.mocked(managesTeammate).mockResolvedValue(true);
  });

  it("refuses a raise the workspace cannot cover and says how much is left", async () => {
    const { context, update } = createContext({
      record: employment(),
      teammateSpend: 18 * CREDIT,
      workspaceCap: 70 * CREDIT,
      workspaceSpend: 60 * CREDIT,
    });

    await expect(
      setReportBudget(context, {
        workspaceId: "ws",
        managerId: "atlas",
        teammateId: "mara",
        monthlyCreditCapMicros: 40 * CREDIT,
        reason: "More copy",
      }),
    ).rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining("10 credits") });
    expect(update).not.toHaveBeenCalled();
  });

  it("leaves raises to a person when the workspace has no budget", async () => {
    const { context } = createContext({ record: employment(), teammateSpend: 0 });

    await expect(
      setReportBudget(context, {
        workspaceId: "ws",
        managerId: "atlas",
        teammateId: "mara",
        monthlyCreditCapMicros: 25 * CREDIT,
        reason: "More copy",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not let a manager change someone else's report", async () => {
    vi.mocked(managesTeammate).mockResolvedValue(false);
    const stranger = createContext({ record: employment(), teammateSpend: 0 });

    await expect(
      setReportBudget(stranger.context, {
        workspaceId: "ws",
        managerId: "juno",
        teammateId: "mara",
        monthlyCreditCapMicros: 10 * CREDIT,
        reason: "Quiet month",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
