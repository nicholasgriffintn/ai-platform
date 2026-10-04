import { describe, expect, it } from "vitest";

import { findPlatformTeammate } from "./platform-teammates.js";
import type { ProjectFlow } from "./project-tasks.js";
import { createProjectFlowFromWorkflow, PROJECT_WORKFLOWS } from "./project-workflows.js";

describe("project workflows", () => {
  it("only routes stages through platform teammates that exist", () => {
    for (const workflow of PROJECT_WORKFLOWS) {
      for (const stage of workflow.stages) {
        if (stage.teammateId) {
          expect(
            findPlatformTeammate(stage.teammateId),
            `${workflow.slug}: ${stage.teammateId}`,
          ).toBeDefined();
        }
      }
    }
  });

  it("hands the edited flow a copy rather than the catalogue entry", () => {
    const first = createProjectFlowFromWorkflow(PROJECT_WORKFLOWS[0].slug) as ProjectFlow;

    first.stages[0].name = "Changed";
    first.stages[0].skillIds.push("injected");

    const second = createProjectFlowFromWorkflow(PROJECT_WORKFLOWS[0].slug) as ProjectFlow;

    expect(second.stages[0].name).not.toBe("Changed");
    expect(second.stages[0].skillIds).not.toContain("injected");
  });
});
