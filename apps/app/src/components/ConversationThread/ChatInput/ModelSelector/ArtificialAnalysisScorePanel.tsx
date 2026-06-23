import { ExternalLink } from "lucide-react";

import type { ModelConfigItem } from "@assistant/schemas";

type ArtificialAnalysisScore = {
	key: "intelligenceIndex" | "codingIndex" | "agenticIndex";
	label: string;
	href: string;
};

type DisplayScore = {
	key: string;
	label: string;
	value: number;
	href: string;
	min?: number;
	max?: number;
	lowerIsBetter?: boolean;
	confidenceInterval95?: number | null;
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

function getScoreWidth(score: DisplayScore) {
	const min = score.min ?? 0;
	const max = score.max ?? 100;
	const range = max - min;
	if (range <= 0) {
		return "0%";
	}

	const boundedValue = Math.min(max, Math.max(min, score.value));
	const ratio = (boundedValue - min) / range;
	const percentage = score.lowerIsBetter ? (1 - ratio) * 100 : ratio * 100;
	return `${Math.min(100, Math.max(0, percentage))}%`;
}

function formatScore(score: number) {
	if (Number.isInteger(score)) {
		return String(score);
	}
	return Math.abs(score) < 1
		? score.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
		: score.toFixed(1);
}

function buildDisplayScores(
	analysis: NonNullable<ModelConfigItem["artificialAnalysis"]>,
): DisplayScore[] {
	const languageScores = SCORE_ITEMS.flatMap((item) => {
		const value = analysis[item.key];
		if (typeof value !== "number") {
			return [];
		}

		return [
			{
				key: item.key,
				label: item.label,
				value,
				href: item.href,
			},
		];
	});
	const mediaScores = (analysis.mediaScores ?? []).map((score) => ({
		key: score.key,
		label: score.label,
		value: score.value,
		href: ARTIFICIAL_ANALYSIS_EVALUATIONS_URL,
		min: score.min,
		max: score.max,
		lowerIsBetter: score.lowerIsBetter,
		confidenceInterval95: score.confidenceInterval95,
	}));

	return [...languageScores, ...mediaScores];
}

function getPanelTitle(analysis: NonNullable<ModelConfigItem["artificialAnalysis"]>) {
	const hasLanguageScores = SCORE_ITEMS.some((item) => typeof analysis[item.key] === "number");
	const hasMediaScores = (analysis.mediaScores ?? []).length > 0;

	return hasLanguageScores && !hasMediaScores ? "Evaluation scores" : "Artificial Analysis scores";
}

export function ArtificialAnalysisScorePanel({
	analysis,
}: {
	analysis: NonNullable<ModelConfigItem["artificialAnalysis"]>;
}) {
	const scores = buildDisplayScores(analysis);

	if (scores.length === 0) {
		return null;
	}

	return (
		<div className="rounded-lg border border-zinc-200/70 p-2.5 dark:border-zinc-700/70">
			<div className="mb-2 flex items-center justify-between gap-2">
				<span className="font-semibold text-zinc-500 dark:text-zinc-400">
					{getPanelTitle(analysis)}
				</span>
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
						aria-label={`${item.label} score ${formatScore(item.value)}`}
						className="group rounded-md border border-zinc-200/70 bg-zinc-50/80 px-2 py-1.5 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-700/70 dark:bg-zinc-800/70 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
					>
						<div className="mb-1 flex items-center justify-between gap-2">
							<span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
								{item.label}
							</span>
							<span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
								{formatScore(item.value)}
								{typeof item.confidenceInterval95 === "number" ? (
									<span className="text-zinc-400">±{formatScore(item.confidenceInterval95)}</span>
								) : null}
								<ExternalLink className="h-3 w-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
							</span>
						</div>
						<div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
							<div
								className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
								style={{ width: getScoreWidth(item) }}
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
