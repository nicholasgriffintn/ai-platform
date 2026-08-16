import { escapeHtml } from "~/utils/html";
import type { ResponseStyle } from "../utils";
import { PromptBuilder } from "../builder";

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
