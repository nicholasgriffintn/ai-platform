import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { createTemplate } from "~/modules/templates/application";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { saveTeamTemplate } from "../team-template";

vi.mock("~/modules/templates/application", () => ({
  createTemplate: vi.fn(async (_context, _userId, input) => input),
  getTemplate: vi.fn(),
}));

function member(teammateId: string, reportsToTeammateId: string | null, projectIds: string[]) {
  return {
    workspaceId: "workspace-1",
    teammateId,
    title: teammateId,
    reportsToTeammateId,
    status: "active",
    heartbeatMinutes: null,
    monthlyCreditCapMicros: null,
    projectIds,
  };
}

describe("saving a team template", () => {
  let context: ServiceContext;

  beforeEach(() => {
    vi.mocked(createTemplate).mockClear();
    context = Object.assign(Object.create(null), {
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
      repositories: fakeRepositories([
        [
          WorkspaceRepository,
          {
            getWorkspace: vi.fn().mockResolvedValue({
              id: "workspace-1",
              name: "Harbour Bakery",
              description: "",
              mission: "Run a neighbourhood bakery",
              monthly_credit_cap_micros: null,
              lead_teammate_id: "lead",
              setup_project_id: "company",
            }),
            getMembership: vi.fn().mockResolvedValue({ role: "owner" }),
            listProjects: vi.fn().mockResolvedValue([
              {
                id: "company",
                name: "Company",
                description: "",
                task_prefix: "WRK",
                archived_at: null,
              },
              {
                id: "menu",
                name: "Weekly menu",
                description: "Menus",
                task_prefix: "MENU",
                initiative_id: "operations",
                standup: null,
                archived_at: null,
              },
            ]),
          },
        ],
        [
          InitiativeRepository,
          {
            listForWorkspace: vi
              .fn()
              .mockResolvedValue([{ id: "operations", name: "Run smoothly", description: "" }]),
          },
        ],
        [
          WorkspaceTeammateRepository,
          {
            listForWorkspace: vi
              .fn()
              .mockResolvedValue([
                member("lead", null, ["company", "menu"]),
                member("coordinator", "lead", ["menu"]),
                member("baker", "coordinator", ["menu", "company"]),
              ]),
          },
        ],
        [
          TeammateRepository,
          {
            getTeammatesByIds: vi.fn().mockResolvedValue([
              { id: "coordinator", name: "Coordinator", system_prompt: "Plan the week." },
              { id: "baker", name: "Baker", system_prompt: "Bake." },
            ]),
          },
        ],
      ]),
    });
  });

  it("keeps the team and its reporting lines but leaves out the lead and setup project", async () => {
    await saveTeamTemplate(context, "workspace-1", { name: "Bakery team", description: "" });

    const configuration = vi.mocked(createTemplate).mock.calls[0]?.[2].configuration;

    expect(configuration).toMatchObject({
      projects: [{ key: "p1", name: "Weekly menu", taskPrefix: "MENU", initiative: "i1" }],
      teammates: [
        { key: "t1", name: "Coordinator", reportsTo: null, projects: ["p1"] },
        { key: "t2", name: "Baker", reportsTo: "t1", projects: ["p1"] },
      ],
      tasks: [],
      connectors: [],
    });
  });
});
