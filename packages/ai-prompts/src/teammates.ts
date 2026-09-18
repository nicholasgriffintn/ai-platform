import { PromptNotFoundError } from "./errors.js";
import { tryGetPrompt } from "./prompts.js";

function requireTeammatePrompt(id: string): string {
  const entry = tryGetPrompt(id);

  if (!entry) {
    throw new PromptNotFoundError(id);
  }

  return entry.text;
}

export function getCouncilMemberPrompt(memberId: string): string {
  return requireTeammatePrompt(`teammates/council/${memberId}`);
}

export function getTeammateRoleBrief(roleSlug: string): string {
  return requireTeammatePrompt(`teammates/roles/${roleSlug}`);
}

export function getPlatformTeammateBrief(teammateId: string): string {
  return requireTeammatePrompt(`teammates/platform/${teammateId}`);
}

export function buildHiredTeammateBrief({
  roleSlug,
  jobDescription,
}: {
  roleSlug?: string | null;
  jobDescription?: string | null;
}): string {
  const sections = [
    roleSlug ? getTeammateRoleBrief(roleSlug) : undefined,
    jobDescription?.trim(),
  ].filter((section): section is string => Boolean(section));

  return sections.join("\n\n");
}
