import { escapeHtml } from "@ngriffin_uk/polychat-utility-core";

import { PromptBuilder } from "~/services/chat/prompts/builder";
import type { ResponseStyle } from "~/services/chat/prompts/utils";

type ResponseStyleOptions = ResponseStyle;

export function buildResponseStyleSection({ traits, preferences }: ResponseStyleOptions): string {
  return new PromptBuilder("<response_style>")
    .addLine()
    .addLine(`<traits>${escapeHtml(traits)}</traits>`)
    .addLine("<preferences>")
    .addLine(escapeHtml(preferences))
    .addLine("</preferences>")
    .addLine("</response_style>")
    .addLine()
    .build();
}
