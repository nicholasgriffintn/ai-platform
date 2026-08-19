import { SKILL_LOAD_TOOL_NAME, type SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import type { SkillContent } from "~/services/skills";
import { escapeHtml } from "~/utils/html";

import { PromptBuilder } from "../builder";

export interface PromptSkillContext {
  available?: readonly SkillAvailability[];
  pinned?: readonly SkillContent[];
}

function buildPinnedSection(pinned: readonly SkillContent[]): string {
  if (pinned.length === 0) {
    return "";
  }

  const builder = new PromptBuilder("<pinned_skills>").addLine(
    "These skills are pinned for this conversation. Their full instructions are below; follow them without loading them again.",
  );

  for (const skill of pinned) {
    builder
      .addLine(`<skill name="${escapeHtml(skill.name)}">`)
      .addLine(skill.body)
      .addLine("</skill>");
  }

  return builder.addLine("</pinned_skills>").addLine().build();
}

export function buildSkillsSection(context: PromptSkillContext | undefined): string {
  const pinnedIds = new Set((context?.pinned ?? []).map((skill) => skill.name));
  const ready = (context?.available ?? []).filter(
    (skill) => skill.state === "ready" && !pinnedIds.has(skill.id),
  );
  const pinnedSection = buildPinnedSection(context?.pinned ?? []);

  if (ready.length === 0) {
    return pinnedSection;
  }

  const builder = new PromptBuilder("<available_skills>")
    .addLine(
      "Skills carry specialised instructions for specific kinds of work. Only names and descriptions are disclosed here; load the full SKILL.md when one applies.",
    )
    .addLine(
      `When a request matches one, call ${SKILL_LOAD_TOOL_NAME} with that skill's name and follow what it returns. Load it before starting the work, not after. Never guess at a skill's contents, and never name a skill that is not listed here.`,
    );

  for (const skill of ready) {
    builder
      .addLine("<skill>")
      .addLine(`<name>${escapeHtml(skill.id)}</name>`)
      .addLine(`<description>${escapeHtml(skill.description)}</description>`)
      .addLine("</skill>");
  }

  return `${pinnedSection}${builder.addLine("</available_skills>").addLine().build()}`;
}
