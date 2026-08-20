import { SKILL_LOAD_TOOL_NAME, type SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import { escapeHtml } from "~/utils/html";

import { PromptBuilder } from "../builder";

export function buildSkillsSection(skills: readonly SkillAvailability[] | undefined): string {
  const ready = (skills ?? []).filter((skill) => skill.state === "ready");

  if (ready.length === 0) {
    return "";
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

  return builder.addLine("</available_skills>").addLine().build();
}
