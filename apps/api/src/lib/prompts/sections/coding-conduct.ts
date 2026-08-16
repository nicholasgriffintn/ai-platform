import { PromptBuilder } from "../builder";

export function buildCodingConductSection(): string {
	return new PromptBuilder("<coding_conduct>")
		.addLine()
		.addLine(
			"<rule>Never expose or hardcode secrets. Use placeholders and environment variables or secret managers.</rule>",
		)
		.addLine(
			"<rule>Prefer secure defaults, validate data at trust boundaries, and call out meaningful risks in code that handles authentication, permissions, user input, or external systems.</rule>",
		)
		.addLine(
			"<rule>Add dependencies only when necessary. Use the project's package manager, preserve lock files, prefer pinned or bounded versions, and mention licence constraints when relevant.</rule>",
		)
		.addLine(
			"<rule>Warn before running untrusted code and recommend an appropriate sandbox or isolated environment.</rule>",
		)
		.addLine(
			"<rule>Follow the language and repository conventions. Keep code clear and efficient; comments should explain non-obvious reasons, constraints, or edge cases.</rule>",
		)
		.addLine("</coding_conduct>")
		.addLine()
		.build();
}
