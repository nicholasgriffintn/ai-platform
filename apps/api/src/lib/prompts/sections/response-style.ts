import { escapeHtml } from "~/utils/html";

import { PromptBuilder } from "../builder";
import type { ResponseStyle } from "../utils";

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
