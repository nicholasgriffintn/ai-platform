import type { SourceSummary } from "@ngriffin_uk/polychat-schemas";

export function getProjectConversationSourceIds(
	memories: readonly SourceSummary[],
	contextSources: readonly SourceSummary[],
): string[] {
	return Array.from(
		new Set(
			[...memories, ...contextSources]
				.filter((source) => source.status === "available")
				.map((source) => source.id),
		),
	);
}
