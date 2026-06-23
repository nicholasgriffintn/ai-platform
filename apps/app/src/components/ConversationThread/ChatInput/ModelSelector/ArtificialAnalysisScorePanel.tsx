import { ExternalLink } from "lucide-react";

import type { ModelConfigItem } from "@assistant/schemas";

type ArtificialAnalysisScore = {
	key: "intelligenceIndex" | "codingIndex" | "agenticIndex";
	label: string;
	href: string;
};

const ARTIFICIAL_ANALYSIS_SOURCE_LABEL = "Artificial Analysis";
const ARTIFICIAL_ANALYSIS_SOURCE_URL = "https://artificialanalysis.ai/";
const ARTIFICIAL_ANALYSIS_EVALUATIONS_URL = "https://artificialanalysis.ai/evaluations";
const ARTIFICIAL_ANALYSIS_INTELLIGENCE_INDEX_URL =
	"https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index";

const SCORE_ITEMS: ArtificialAnalysisScore[] = [
	{
		key: "intelligenceIndex",
		label: "Intelligence",
		href: ARTIFICIAL_ANALYSIS_INTELLIGENCE_INDEX_URL,
	},
	{
		key: "codingIndex",
		label: "Coding",
		href: ARTIFICIAL_ANALYSIS_EVALUATIONS_URL,
	},
	{
		key: "agenticIndex",
		label: "Agentic",
		href: ARTIFICIAL_ANALYSIS_EVALUATIONS_URL,
	},
];

function getScoreWidth(score: number) {
	return `${Math.min(100, Math.max(0, score))}%`;
}

function formatScore(score: number) {
	return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function ArtificialAnalysisScorePanel({
	analysis,
}: {
	analysis: NonNullable<ModelConfigItem["artificialAnalysis"]>;
}) {
	const scores = SCORE_ITEMS.map((item) => ({
		...item,
		score: analysis[item.key],
	})).filter(
		(item): item is ArtificialAnalysisScore & { score: number } => typeof item.score === "number",
	);

	if (scores.length === 0) {
		return null;
	}

	return (
		<div className="rounded-lg border border-zinc-200/70 p-2.5 dark:border-zinc-700/70">
			<div className="mb-2 flex items-center justify-between gap-2">
				<span className="font-semibold text-zinc-500 dark:text-zinc-400">Evaluation scores</span>
				{analysis.intelligenceIndexVersion ? (
					<span className="text-[11px] text-zinc-400 dark:text-zinc-500">
						v{analysis.intelligenceIndexVersion}
					</span>
				) : null}
			</div>
			<div className="grid gap-1.5">
				{scores.map((item) => (
					<a
						key={item.key}
						href={item.href}
						target="_blank"
						rel="noreferrer"
						aria-label={`${item.label} score ${formatScore(item.score)}`}
						className="group rounded-md border border-zinc-200/70 bg-zinc-50/80 px-2 py-1.5 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-700/70 dark:bg-zinc-800/70 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
					>
						<div className="mb-1 flex items-center justify-between gap-2">
							<span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
								{item.label}
							</span>
							<span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
								{formatScore(item.score)}
								<ExternalLink className="h-3 w-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
							</span>
						</div>
						<div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
							<div
								className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
								style={{ width: getScoreWidth(item.score) }}
							/>
						</div>
					</a>
				))}
			</div>
			<a
				href={ARTIFICIAL_ANALYSIS_SOURCE_URL}
				target="_blank"
				rel="noreferrer"
				className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
			>
				Data from {ARTIFICIAL_ANALYSIS_SOURCE_LABEL}
				<ExternalLink className="h-3 w-3" />
			</a>
		</div>
	);
}
