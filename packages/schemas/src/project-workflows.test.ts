import { describe, expect, it } from "vitest";

import { findPlatformTeammate } from "./platform-teammates.js";
import { createProjectFlowFromWorkflow, PROJECT_WORKFLOWS } from "./project-workflows.js";

describe("project workflows", () => {
  it("only routes stages through platform teammates that exist", () => {
    for (const workflow of PROJECT_WORKFLOWS) {
      for (const stage of workflow.steps) {
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
    const first = createProjectFlowFromWorkflow(PROJECT_WORKFLOWS[0].slug);
    const agent = first?.nodes.find((node) => node.type === "agent");

    if (!first || !agent || agent.type !== "agent") {
      throw new Error("The workflow has no teammate");
    }

    agent.name = "Changed";
    agent.skillIds.push("injected");

    const second = createProjectFlowFromWorkflow(PROJECT_WORKFLOWS[0].slug);
    const unchanged = second?.nodes.find((node) => node.id === agent.id);

    if (!unchanged || unchanged.type !== "agent") {
      throw new Error("The workflow has no teammate");
    }

    expect(unchanged.name).not.toBe("Changed");
    expect(unchanged.skillIds).not.toContain("injected");
  });
});
