import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { clampPercentage } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink } from "lucide-react";

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

  return `${clampPercentage(percentage)}%`;
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
    <div className="rounded-lg border border-border/70 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-muted-foreground">{getPanelTitle(analysis)}</span>
        {analysis.intelligenceIndexVersion ? (
          <span className="text-[11px] text-muted-foreground">
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
            className="border-border bg-surface group rounded-md border px-2 py-1.5 transition-colors hover:border-border-strong hover:bg-selection/60"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                {formatScore(item.value)}
                {typeof item.confidenceInterval95 === "number" ? (
                  <span className="text-muted-foreground">
                    ±{formatScore(item.confidenceInterval95)}
                  </span>
                ) : null}
                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-muted-foreground" />
              </span>
            </div>
            <div className="bg-selection h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-success"
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
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Data from {ARTIFICIAL_ANALYSIS_SOURCE_LABEL}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
