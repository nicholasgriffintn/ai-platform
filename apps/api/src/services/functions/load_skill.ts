import { loadSkillInputSchema, SKILL_LOAD_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import { getSkillResource, loadSkill, resolveRequestSkillState } from "~/services/skills";
import {
  createSkillInstructionsResponse,
  createSkillResourceResponse,
  isSkillResourceWithinLoadLimit,
  MAX_SKILL_RESOURCE_CONTENT_BYTES,
  toSkillResourceSummary,
} from "~/services/skills/response";
import type { ApiToolDefinition } from "~/types/functions";

export const load_skill: ApiToolDefinition = {
  name: SKILL_LOAD_TOOL_NAME,
  description:
    "Load the full SKILL.md instructions for one of the skills listed in available_skills, or one relative resource path listed by that skill. Call this before starting work the skill covers, and follow what it returns.",
  type: "normal",
  costPerCall: 0,
  isDefault: true,
  maxIdenticalCalls: 1,
  permissions: ["read"],
  inputSchema: loadSkillInputSchema,
  execute: async (args, toolContext) => {
    const skillId = String(args.skill).trim();
    const { catalog, skills: available } = await resolveRequestSkillState(toolContext.request);
    const requested = catalog ? catalog.load(skillId) : await loadSkill(skillId);
    const readyIds = new Set(
      available.filter((skill) => skill.state === "ready").map((skill) => skill.id),
    );

    if (!requested || !readyIds.has(skillId)) {
      return {
        status: "error",
        name: SKILL_LOAD_TOOL_NAME,
        content: `No skill "${skillId}" is available in this conversation. Available skills: ${
          readyIds.size > 0 ? [...readyIds].join(", ") : "none"
        }.`,
        data: { skill: skillId, available: [...readyIds] },
      };
    }

    const resources = (requested.resources ?? []).map(toSkillResourceSummary);
    const resourcePath = typeof args.resource === "string" ? args.resource.trim() : undefined;

    if (resourcePath && resourcePath !== "SKILL.md") {
      const resource = catalog
        ? catalog.readResource(skillId, resourcePath)
        : await getSkillResource(skillId, resourcePath);

      if (!resource) {
        return {
          status: "error",
          name: SKILL_LOAD_TOOL_NAME,
          content: `The ${requested.name} skill has no resource "${resourcePath}". Available resources: ${
            resources.length > 0 ? resources.map((item) => item.path).join(", ") : "none"
          }.`,
          data: { skill: skillId, resources },
        };
      }

      if (!isSkillResourceWithinLoadLimit(resource)) {
        return {
          status: "error",
          name: SKILL_LOAD_TOOL_NAME,
          content: `The ${requested.name} resource "${resourcePath}" is too large to load into the conversation. Resources are limited to ${MAX_SKILL_RESOURCE_CONTENT_BYTES} bytes.`,
          data: { skill: skillId, resource: resourcePath, resources },
        };
      }

      return createSkillResourceResponse(skillId, resource, resources);
    }

    return createSkillInstructionsResponse(requested, resources);
  },
};
