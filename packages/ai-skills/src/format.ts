import type {
  SkillContent,
  SkillResource,
  SkillResourceDescriptor,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import type { SkillResourceSummary } from "@ngriffin_uk/polychat-schemas";
import { escapeHtml } from "@ngriffin_uk/polychat-utility-core";

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
