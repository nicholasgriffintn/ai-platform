import {
  RESPONSE_TOOL_ACTIVATION_DATA_KEY,
  ResponseDisplayType,
  SKILL_LOAD_TOOL_NAME,
  type SkillResourceSummary,
} from "@ngriffin_uk/polychat-schemas";

import type { IFunctionResponse } from "~/types";
import { escapeHtml } from "~/utils/html";

import type { SkillContent, SkillResource, SkillResourceDescriptor } from "./types";

export const MAX_SKILL_RESOURCE_CONTENT_BYTES = 256 * 1024;

export function isSkillResourceWithinLoadLimit(resource: SkillResource): boolean {
  return new TextEncoder().encode(resource.content).byteLength <= MAX_SKILL_RESOURCE_CONTENT_BYTES;
}

export function toSkillResourceSummary(resource: SkillResourceDescriptor): SkillResourceSummary {
  return {
    path: resource.path,
    kind: resource.kind,
    ...(resource.size === undefined ? {} : { size: resource.size }),
    ...(resource.encoding ? { encoding: resource.encoding } : {}),
    ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
  };
}

export function formatSkillContent(skill: SkillContent): string {
  const resources = skill.resources ?? [];
  const resourceList =
    resources.length > 0
      ? `\n\nAvailable resources (load one by passing its exact relative path):\n${resources
          .map((resource) => `- ${escapeHtml(resource.path)} (${resource.kind})`)
          .join("\n")}`
      : "";

  const source = skill.source === "user-authored" ? ' source="user-authored"' : "";

  return `<skill_content name="${escapeHtml(skill.name)}"${source}>\n${skill.body}${resourceList}\n</skill_content>`;
}

export function formatSkillResource(skillName: string, resource: SkillResource): string {
  return `<skill_resource skill="${escapeHtml(skillName)}" path="${escapeHtml(resource.path)}" encoding="${
    resource.encoding ?? "text"
  }">\n${resource.content}\n</skill_resource>`;
}

export function createSkillInstructionsResponse(
  skill: SkillContent,
  resources: SkillResourceSummary[],
  activatedTools: readonly string[] = [],
): IFunctionResponse {
  return {
    status: "success",
    name: SKILL_LOAD_TOOL_NAME,
    content: formatSkillContent(skill),
    data: {
      responseType: ResponseDisplayType.HIDDEN,
      skill: skill.name,
      resources,
      [RESPONSE_TOOL_ACTIVATION_DATA_KEY]: [...activatedTools],
    },
  };
}

export function createSkillResourceResponse(
  skillName: string,
  resource: SkillResource,
  resources: SkillResourceSummary[],
): IFunctionResponse {
  return {
    status: "success",
    name: SKILL_LOAD_TOOL_NAME,
    content: formatSkillResource(skillName, resource),
    data: {
      responseType: ResponseDisplayType.HIDDEN,
      skill: skillName,
      resource: resource.path,
      resources,
    },
  };
}
