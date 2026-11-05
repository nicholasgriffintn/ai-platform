import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { WorkspacePoolRepository } from "~/modules/usage/infrastructure/WorkspacePoolRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import { WorkspaceTeamPlanRepository } from "~/modules/workspaces/infrastructure/WorkspaceTeamPlanRepository";

import {
  endWorkspaceTeamPlan,
  getWorkspaceTeamPlan,
  provisionWorkspaceTeamPlan,
} from "../team-plan";

const WORKSPACE_ID = "workspace-1";

function createHarness(user: { role?: string; plan_id?: string } = {}) {
  const plans = {
    getPlan: vi.fn().mockResolvedValue({ seat_limit: 5 }),
    savePlan: vi.fn().mockResolvedValue(undefined),
    deletePlan: vi.fn().mockResolvedValue(true),
    countOccupiedSeats: vi.fn().mockResolvedValue(3),
  };
  const pool = {
    getPool: vi.fn().mockResolvedValue({
      included_credit_micros: 2_000_000,
      grace_credit_micros: 0,
      spent_credit_micros: 500_000,
      reserved_credit_micros: 0,
      overrun_credit_micros: 0,
      last_event_at: null,
    }),
  };
  const audit = { createRecord: vi.fn().mockResolvedValue(undefined) };
  const workspaces = {
    getWorkspace: vi.fn().mockResolvedValue({ id: WORKSPACE_ID }),
    getMembership: vi.fn().mockResolvedValue({ role: "member" }),
  };
  const context = {
    requireUser: vi.fn().mockReturnValue({ id: 1, plan_id: "pro", role: "admin", ...user }),
    repositories: fakeRepositories([
      [WorkspaceTeamPlanRepository, plans],
      [WorkspacePoolRepository, pool],
      [AuditRepository, audit],
      [WorkspaceRepository, workspaces],
    ]),
  } as unknown as ServiceContext;

  return { context, plans, pool, audit, workspaces };
}

const input = { seatLimit: 5, includedCredits: 2, graceCredits: 0 };

describe("workspace team plan", () => {
  it("shows a member the seats and shared pool", async () => {
    const { context } = createHarness({ role: "user" });

    await expect(getWorkspaceTeamPlan(context, WORKSPACE_ID)).resolves.toMatchObject({
      teamPlan: {
        seats: { limit: 5, occupied: 3, available: 2 },
        pool: { credits: { included: 2, used: 0.5, overage_enabled: false } },
      },
    });
  });

  it("hides the plan from someone outside the workspace", async () => {
    const { context, workspaces, pool } = createHarness({ role: "user" });

    workspaces.getMembership.mockResolvedValue(null);

    await expect(getWorkspaceTeamPlan(context, WORKSPACE_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(pool.getPool).not.toHaveBeenCalled();
  });

  it("stores the allowance a platform administrator sets and audits it", async () => {
    const { context, plans, audit } = createHarness();

    await provisionWorkspaceTeamPlan(context, WORKSPACE_ID, input);

    expect(plans.savePlan).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      seatLimit: 5,
      includedCreditMicros: 2_000_000,
      graceCreditMicros: 0,
      provisionedBy: 1,
    });
    expect(audit.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "workspace.team_plan.provisioned" }),
    );
  });

  it("does not let a workspace owner grant itself a pool", async () => {
    const { context, plans } = createHarness({ role: "user" });

    await expect(provisionWorkspaceTeamPlan(context, WORKSPACE_ID, input)).rejects.toMatchObject({
      type: ErrorType.FORBIDDEN,
    });
    await expect(endWorkspaceTeamPlan(context, WORKSPACE_ID)).rejects.toMatchObject({
      type: ErrorType.FORBIDDEN,
    });
    expect(plans.savePlan).not.toHaveBeenCalled();
    expect(plans.deletePlan).not.toHaveBeenCalled();
  });

  it("refuses a seat limit below the seats already taken", async () => {
    const { context, plans } = createHarness();

    await expect(
      provisionWorkspaceTeamPlan(context, WORKSPACE_ID, { ...input, seatLimit: 2 }),
    ).rejects.toMatchObject({ type: ErrorType.FORBIDDEN });
    expect(plans.savePlan).not.toHaveBeenCalled();
  });
});
