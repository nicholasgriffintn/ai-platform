import { usagePeriodFromDate } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import {
  WorkspaceTeammateRepository,
  type WorkspaceTeammateRecord,
} from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { reviewWorkBudgets, setReportBudget } from "../budgets";
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

  it("lets a manager raise a paused report within the workspace budget and resumes it", async () => {
    const { context, update } = createContext({
      record: employment({ status: "paused", pausedReason: "budget" }),
      teammateSpend: 20 * CREDIT,
      workspaceCap: 150 * CREDIT,
      workspaceSpend: 60 * CREDIT,
    });

    await setReportBudget(context, {
      workspaceId: "ws",
      managerId: "atlas",
      teammateId: "mara",
      monthlyCreditCapMicros: 30 * CREDIT,
      reason: "The newsletter launch needs another draft.",
    });

    expect(update).toHaveBeenCalledWith(
      "ws",
      "mara",
      expect.objectContaining({
        monthlyCreditCapMicros: 30 * CREDIT,
        status: "active",
        pausedReason: null,
      }),
    );
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

  it("lets a manager lower a budget but not someone else's report", async () => {
    const lowered = createContext({ record: employment(), teammateSpend: 0 });

    await setReportBudget(lowered.context, {
      workspaceId: "ws",
      managerId: "atlas",
      teammateId: "mara",
      monthlyCreditCapMicros: 10 * CREDIT,
      reason: "Quiet month",
    });
    expect(lowered.update).toHaveBeenCalled();

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

describe("reviewWorkBudgets", () => {
  it("resumes a teammate paused for budget once a new month resets its spend", async () => {
    const record = employment({ status: "paused", pausedReason: "budget", budgetAlertAt: "x" });
    const { context, update } = createContext({ record, teammateSpend: 0 });

    const result = await reviewWorkBudgets(context, [record]);

    expect(update).toHaveBeenCalledWith(
      "ws",
      "mara",
      expect.objectContaining({ status: "active", pausedReason: null }),
    );
    expect(result.alerts).toEqual([]);
  });

  it("asks the manager once about a report that run admission already paused", async () => {
    const record = employment({ status: "paused", pausedReason: "budget" });
    const first = createContext({ record, teammateSpend: 21 * CREDIT });

    expect((await reviewWorkBudgets(first.context, [record])).alerts).toEqual([
      expect.objectContaining({ managerId: "atlas", kind: "paused", projectId: "web" }),
    ]);

    const alerted = { ...record, budgetAlertAt: new Date().toISOString() };
    const second = createContext({ record: alerted, teammateSpend: 21 * CREDIT });

    expect((await reviewWorkBudgets(second.context, [alerted])).alerts).toEqual([]);
  });

  it("warns the manager at 80% once per month", async () => {
    const record = employment();
    const { context } = createContext({ record, teammateSpend: 17 * CREDIT });

    expect((await reviewWorkBudgets(context, [record])).alerts).toEqual([
      expect.objectContaining({ kind: "warning" }),
    ]);

    const warned = employment({ budgetWarnedPeriod: usagePeriodFromDate() });
    const again = createContext({ record: warned, teammateSpend: 17 * CREDIT });

    expect((await reviewWorkBudgets(again.context, [warned])).alerts).toEqual([]);
  });
});
