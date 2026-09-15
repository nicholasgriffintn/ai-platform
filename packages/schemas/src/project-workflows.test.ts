import { describe, expect, it } from "vitest";

import { findPlatformTeammate } from "./platform-teammates.js";
import { PROJECT_FLOW_MAX_STAGES, projectFlowSchema, type ProjectFlow } from "./project-tasks.js";
import {
  createProjectFlowFromWorkflow,
  findProjectWorkflow,
  PROJECT_WORKFLOWS,
} from "./project-workflows.js";

describe("project workflows", () => {
  it("keeps workflow slugs unique and resolvable", () => {
    expect(PROJECT_WORKFLOWS.length).toBeGreaterThan(0);
    expect(new Set(PROJECT_WORKFLOWS.map((workflow) => workflow.slug)).size).toBe(
      PROJECT_WORKFLOWS.length,
    );

    for (const workflow of PROJECT_WORKFLOWS) {
      expect(findProjectWorkflow(workflow.slug)).toBe(workflow);
    }

    expect(findProjectWorkflow("not-a-workflow")).toBeUndefined();
    expect(createProjectFlowFromWorkflow("not-a-workflow")).toBeNull();
  });

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

  it("produces flows that pass the project flow contract", () => {
    for (const workflow of PROJECT_WORKFLOWS) {
      expect(workflow.stages.length).toBeLessThanOrEqual(PROJECT_FLOW_MAX_STAGES);

      const flow = createProjectFlowFromWorkflow(workflow.slug);
      const parsed = projectFlowSchema.safeParse(flow);

      expect(parsed.success, workflow.slug).toBe(true);
      expect(parsed.data?.stages.map((stage) => stage.id)).toEqual(
        workflow.stages.map((stage) => stage.id),
      );
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
