import { setupPlanSchema } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { listConnectedConnectors } from "~/modules/connectors/application/connected";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { proposeSetupPlan } from "../onboarding";

vi.mock("~/modules/connectors/application/connected", () => ({
  listConnectedConnectors: vi.fn(),
  connectorOperationsForAccess: vi.fn(),
}));

const caller = {
  actor: { type: "teammate" as const, id: "lead" },
  author: { kind: "teammate" as const, name: "Lead", userId: null, teammateId: "lead" },
};

function plan(connectors: unknown[], suggestions: unknown[] = []) {
  return setupPlanSchema.parse({
    mission: "Run a neighbourhood bakery",
    projects: [{ key: "menu", name: "Weekly menu", taskPrefix: "MENU" }],
    connectors,
    suggestions,
  });
}

describe("proposing a setup plan", () => {
  const updateWorkspace = vi.fn();
  let context: ServiceContext;

  beforeEach(() => {
    updateWorkspace.mockReset();
    vi.mocked(listConnectedConnectors).mockResolvedValue([
      { id: "googlesheets", name: "Google Sheets" },
    ]);
    context = Object.assign(Object.create(null), {
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
      repositories: fakeRepositories([
        [
          WorkspaceRepository,
          {
            getWorkspace: vi
              .fn()
              .mockResolvedValue({ id: "workspace-1", setup_plan: null, setup_task_id: null }),
            getMembership: vi.fn().mockResolvedValue({ role: "owner" }),
            updateWorkspace,
          },
        ],
      ]),
    });
  });

  it("only lets the plan use services that are already connected", async () => {
    await expect(
      proposeSetupPlan(
        context,
        "workspace-1",
        plan([{ provider: "gmail", access: "write", projects: ["menu"] }]),
        caller,
      ),
    ).rejects.toThrow("gmail is not connected; move it to suggestions");
    expect(updateWorkspace).not.toHaveBeenCalled();
  });

  it("keeps unconnected services as suggestions alongside connected ones", async () => {
    const state = await proposeSetupPlan(
      context,
      "workspace-1",
      plan(
        [{ provider: "googlesheets", access: "read", projects: ["menu"] }],
        [{ provider: "gmail", reason: "Read supplier confirmations" }],
      ),
      caller,
    );

    expect(state.plan.connectors.map((connector) => connector.provider)).toEqual(["googlesheets"]);
    expect(state.plan.suggestions.map((suggestion) => suggestion.provider)).toEqual(["gmail"]);
  });
});
