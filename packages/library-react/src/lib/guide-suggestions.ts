import type { SkillGuide } from "@ngriffin_uk/polychat-schemas";

import type { ChatSuggestion } from "./chat-suggestions/types.js";

export function buildGuideSuggestions(guide: SkillGuide): ChatSuggestion[] {
  return guide.starters.map((starter, index) => ({
    id: `${guide.skillId}-${index}`,
    label: starter,
    prompt: starter,
    category: guide.name,
  }));
}

export function buildGuideOpening(guide: SkillGuide): { label: string; markdown: string } {
  return { label: guide.name, markdown: guide.opening };
}
