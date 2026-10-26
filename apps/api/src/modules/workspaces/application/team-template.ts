import {
  setupPlanSchema,
  standupSettingsSchema,
  type SaveTeamTemplateInput,
  type SetupPlan,
  type Template,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson, truncateText } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { createTemplate, getTemplate } from "~/modules/templates/application";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { requireWorkspaceAccess } from "./access";

const JOB_DESCRIPTION_LIMIT = 4000;

async function buildTeamPlan(context: ServiceContext, workspaceId: string): Promise<SetupPlan> {
  const { workspace } = await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const [projects, initiatives, team] = await Promise.all([
    context.repositories.get(WorkspaceRepository).listProjects(workspaceId),
    context.repositories.get(InitiativeRepository).listForWorkspace(workspaceId),
    context.repositories.get(WorkspaceTeammateRepository).listForWorkspace(workspaceId),
  ]);
  const members = team.filter(
    (member) =>
      member.teammateId !== workspace.lead_teammate_id &&
      (member.status === "active" || member.status === "paused"),
  );
  const teammates = await context.repositories
    .get(TeammateRepository)
    .getTeammatesByIds(members.map((member) => member.teammateId));
  const kept = projects.filter(
    (project) => project.id !== workspace.setup_project_id && !project.archived_at,
  );
  const initiativeKeys = new Map(
    initiatives.map((initiative, index) => [initiative.id, `i${index + 1}`]),
  );
  const projectKeys = new Map(kept.map((project, index) => [project.id, `p${index + 1}`]));
  const teammateKeys = new Map(
    members.map((member, index) => [member.teammateId, `t${index + 1}`]),
  );

  return setupPlanSchema.parse({
    mission: workspace.mission || workspace.description || workspace.name,
    monthlyCreditCapMicros: workspace.monthly_credit_cap_micros ?? null,
    initiatives: initiatives.map((initiative) => ({
      key: initiativeKeys.get(initiative.id),
      name: initiative.name,
      description: initiative.description,
    })),
    projects: kept.map((project) => {
      const standup = standupSettingsSchema.safeParse(
        project.standup ? safeParseJson(project.standup) : null,
      );

      return {
        key: projectKeys.get(project.id),
        name: project.name,
        description: truncateText(project.description, 1000),
        taskPrefix: project.task_prefix ?? "TSK",
        initiative: project.initiative_id
          ? (initiativeKeys.get(project.initiative_id) ?? null)
          : null,
        standup: standup.success ? { ...standup.data, shareBindingId: null } : null,
      };
    }),
    teammates: members.flatMap((member) => {
      const teammate = teammates.find((candidate) => candidate.id === member.teammateId);

      return teammate
        ? [
            {
              key: teammateKeys.get(member.teammateId),
              name: teammate.name,
              title: member.title,
              jobDescription: truncateText(teammate.system_prompt ?? "", JOB_DESCRIPTION_LIMIT),
              reportsTo: member.reportsToTeammateId
                ? (teammateKeys.get(member.reportsToTeammateId) ?? null)
                : null,
              heartbeatMinutes: member.heartbeatMinutes,
              monthlyCreditCapMicros: member.monthlyCreditCapMicros,
              projects: member.projectIds.flatMap((projectId) => {
                const key = projectKeys.get(projectId);

                return key ? [key] : [];
              }),
            },
          ]
        : [];
    }),
  });
}

export async function saveTeamTemplate(
  context: ServiceContext,
  workspaceId: string,
  input: SaveTeamTemplateInput,
): Promise<Template> {
  const plan = await buildTeamPlan(context, workspaceId);

  if (plan.projects.length === 0) {
    throw new AssistantError(
      "Add a project before saving the team as a template",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return createTemplate(context, context.requireUser().id, {
    workspaceId: null,
    kind: "team",
    name: input.name,
    description: input.description,
    configuration: plan,
    status: "active",
  });
}

export async function readTeamTemplatePlan(
  context: ServiceContext,
  templateId: string,
): Promise<{ name: string; plan: SetupPlan }> {
  const template = await getTemplate(context, context.requireUser().id, templateId);
  const plan = setupPlanSchema.safeParse(template.configuration);

  if (template.kind !== "team" || !plan.success) {
    throw new AssistantError("That is not a team template", ErrorType.PARAMS_ERROR, 400);
  }

  return { name: template.name, plan: plan.data };
}
