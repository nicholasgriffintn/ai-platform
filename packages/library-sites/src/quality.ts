import {
  decisionNoulConfidence,
  decisionNoulIsTrue,
  listSitePages,
  normaliseDecisionScore,
  roundDecisionScore,
  type DecisionAnswer,
  type DecisionChoiceQuestion,
  type DecisionNoulQuestion,
  type DecisionScoreQuestion,
  type ModelTier,
  type SiteIssue,
  type SitePlan,
  type SiteProject,
  type SiteQuality,
  type SiteRefineIntent,
} from "@ngriffin_uk/polychat-schemas";

import { describeSiteOutline } from "./edit.js";

export const SITE_REFINE_INTENT_QUESTIONS = {
  intent: {
    type: "choice",
    instructions: "What kind of change is the request asking for?",
    criteria: {
      tweak: "A small change to one element: its copy, a colour, a size, an image, one prop.",
      restructure:
        "Adding, removing, reordering or reworking sections, or changing how a page is laid out.",
      page: "Adding a whole new page or turning one page into several.",
      theme: "The look of the whole site: palette, fonts, dark mode, spacing, tone of all copy.",
    },
  } satisfies DecisionChoiceQuestion,
  interactive: {
    type: "noul",
    instructions:
      "Does the change need live behaviour (filters, forms that add records, tabs that switch, state) rather than static content?",
  } satisfies DecisionNoulQuestion,
} as const;

export type SiteRefineIntentAnswers = Partial<
  Record<keyof typeof SITE_REFINE_INTENT_QUESTIONS | "target", DecisionAnswer>
>;

export interface SiteRefineTargetCandidate {
  pageId: string;
  elementKey: string;
  label: string;
}

export const SITE_REFINE_TARGET_LIMIT = 200;

export function listSiteRefineTargets(project: SiteProject): SiteRefineTargetCandidate[] {
  const candidates: SiteRefineTargetCandidate[] = [];

  for (const { id: pageId, page } of listSitePages(project)) {
    for (const [elementKey, element] of Object.entries(page.elements)) {
      if (elementKey === page.root) {
        continue;
      }

      const text =
        typeof element.props.headline === "string"
          ? element.props.headline
          : typeof element.props.title === "string"
            ? element.props.title
            : typeof element.props.text === "string"
              ? element.props.text
              : typeof element.props.label === "string"
                ? element.props.label
                : "";

      candidates.push({
        pageId,
        elementKey,
        label: `${element.type} on ${page.title}${text ? `: "${text.slice(0, 60)}"` : ""}`,
      });
    }
  }

  return candidates.slice(0, SITE_REFINE_TARGET_LIMIT);
}

export function buildSiteRefineTargetQuestion(
  candidates: readonly SiteRefineTargetCandidate[],
): DecisionChoiceQuestion | null {
  if (candidates.length < 2) {
    return null;
  }

  return {
    type: "choice",
    instructions:
      "Which element does the request refer to? Pick the single element that would change; if the request touches several sections or the whole page, pick the most specific one it names.",
    criteria: Object.fromEntries(
      candidates.map((candidate) => [
        `${candidate.pageId}:${candidate.elementKey}`,
        candidate.label,
      ]),
    ),
  };
}

export function buildSiteRefineIntentState(request: string, project: SiteProject) {
  return { request, outline: describeSiteOutline(project) };
}

export interface ResolvedRefineIntent {
  intent: SiteRefineIntent;
  tier: ModelTier;
  target: { pageId: string; elementKey: string } | null;
  confidence: number;
}

const TARGET_CONFIDENCE_THRESHOLD = 0.7;

export function resolveSiteRefineIntent(
  answers: SiteRefineIntentAnswers,
  plan: SitePlan,
  candidates: readonly SiteRefineTargetCandidate[],
): ResolvedRefineIntent {
  const intentAnswer = answers.intent;
  const intent: SiteRefineIntent =
    intentAnswer?.type === "choice" &&
    ["tweak", "restructure", "page", "theme"].includes(intentAnswer.choice)
      ? (intentAnswer.choice as SiteRefineIntent)
      : "restructure";
  const interactive =
    answers.interactive?.type === "noul" ? decisionNoulIsTrue(answers.interactive) : false;
  const tier: ModelTier =
    intent === "tweak" || intent === "theme"
      ? "low"
      : intent === "page"
        ? plan.tier === "low"
          ? "medium"
          : plan.tier
        : interactive && plan.tier === "low"
          ? "medium"
          : plan.tier;
  let target: ResolvedRefineIntent["target"] = null;

  if (
    intent === "tweak" &&
    answers.target?.type === "choice" &&
    answers.target.confidence >= TARGET_CONFIDENCE_THRESHOLD
  ) {
    const [pageId, elementKey] = answers.target.choice.split(":");
    const candidate = candidates.find(
      (entry) => entry.pageId === pageId && entry.elementKey === elementKey,
    );

    target = candidate ? { pageId: candidate.pageId, elementKey: candidate.elementKey } : null;
  }

  return {
    intent,
    tier,
    target,
    confidence: intentAnswer?.type === "choice" ? intentAnswer.confidence : 0,
  };
}

export const SITE_QUALITY_QUESTIONS = {
  coverage: {
    type: "score",
    instructions:
      "How completely does the site cover what the brief asked for? Consider named pages, sections, features, audience and any specific content the brief mentions.",
    criteria: [
      "Misses most of the brief.",
      "Covers the gist but skips several things the brief asked for.",
      "Covers nearly everything, with one or two gaps.",
      "Covers the whole brief.",
    ],
  } satisfies DecisionScoreQuestion,
  placeholders: {
    type: "noul",
    instructions:
      "Does the copy contain placeholder or generic filler, such as lorem ipsum, 'Feature 1', 'Your headline here', unnamed people or made-up statistics presented as facts?",
  } satisfies DecisionNoulQuestion,
  coherent: {
    type: "noul",
    instructions:
      "Do the pages read as one site: consistent brand name, matching navigation across pages, and copy in one voice?",
  } satisfies DecisionNoulQuestion,
  readable: {
    type: "noul",
    instructions:
      "Is the site's important copy likely to remain readable across its component and background combinations? Use the element hierarchy and props to look for foreground/background conflicts, low-emphasis copy on inverted or primary surfaces, and content hidden by its container.",
  } satisfies DecisionNoulQuestion,
} as const;

const PLACEHOLDER_THRESHOLD = 0.65;

export type SiteQualityAnswers = Partial<
  Record<keyof typeof SITE_QUALITY_QUESTIONS, DecisionAnswer>
>;

function sampleSiteCopy(project: SiteProject, limit = 6000): string {
  const pages = listSitePages(project);

  if (pages.length === 0) {
    return "";
  }

  const pageBudget = Math.max(1, Math.floor(limit / pages.length));
  const samples = pages.map(({ page }) => {
    const lines = [`# ${page.title} (${page.path})`];

    for (const [key, element] of Object.entries(page.elements)) {
      const text = JSON.stringify(element.props);

      if (text !== "{}") {
        lines.push(`${key} ${element.type}: ${text.slice(0, 400)}`);
      }
    }

    return lines.join("\n").slice(0, pageBudget);
  });

  return samples.join("\n").slice(0, limit);
}

export function buildSiteQualityState(brief: string, project: SiteProject) {
  return { brief, outline: describeSiteOutline(project), content: sampleSiteCopy(project) };
}

export function resolveSiteQuality(
  answers: SiteQualityAnswers,
  issues: readonly SiteIssue[],
): SiteQuality {
  const coverage =
    answers.coverage?.type === "score" ? normaliseDecisionScore(answers.coverage) : 0.5;
  const coverageLevel =
    answers.coverage?.type === "score" ? roundDecisionScore(answers.coverage) : 2;
  const placeholders = answers.placeholders?.type === "noul" ? answers.placeholders.noul : 0;
  const coherent = answers.coherent?.type === "noul" ? answers.coherent.noul : 1;
  const readable = answers.readable?.type === "noul" ? answers.readable.noul : 1;
  const repairs = issues.filter((issue) => issue.severity === "warning").length;
  const needsRepair =
    coverageLevel <= 1 ||
    placeholders >= PLACEHOLDER_THRESHOLD ||
    coherent < 0.5 ||
    readable < 0.5 ||
    repairs >= 3;
  const repairSignals = [
    ...(coverageLevel <= 1 && answers.coverage?.type === "score"
      ? [answers.coverage.confidence]
      : []),
    ...(placeholders >= PLACEHOLDER_THRESHOLD && answers.placeholders?.type === "noul"
      ? [decisionNoulConfidence(answers.placeholders)]
      : []),
    ...(coherent < 0.5 && answers.coherent?.type === "noul"
      ? [decisionNoulConfidence(answers.coherent)]
      : []),
    ...(readable < 0.5 && answers.readable?.type === "noul"
      ? [decisionNoulConfidence(answers.readable)]
      : []),
    ...(repairs >= 3 ? [1] : []),
  ];

  return {
    coverage,
    placeholders,
    coherent,
    readable,
    repairs,
    needsRepair,
    confidence: answers.coverage?.type === "score" ? answers.coverage.confidence : 0,
    repairConfidence: repairSignals.length ? Math.max(...repairSignals) : 0,
  };
}

export function buildSiteRepairPrompt(
  brief: string,
  quality: SiteQuality,
  issues: readonly SiteIssue[],
): string {
  const lines = [
    "Review the site against the original brief and fix what is missing or weak, changing as little as possible elsewhere.",
    "",
    `Brief: ${brief.trim()}`,
  ];

  if (quality.coverage < 0.75) {
    lines.push(
      "The site covers only part of the brief. Add or extend the sections and pages the brief asks for.",
    );
  }

  if (quality.placeholders >= PLACEHOLDER_THRESHOLD) {
    lines.push(
      "Some copy reads as placeholder or filler. Replace it with specific copy that fits the brief, and remove made-up statistics or quotes.",
    );
  }

  if (quality.coherent < 0.5) {
    lines.push(
      "The pages do not read as one site. Align the brand name, navigation and voice across every page.",
    );
  }

  if ((quality.readable ?? 1) < 0.5) {
    lines.push(
      "Some important copy may not be readable against its surface. Prefer semantic backgrounds and tones with clear contrast, and avoid low-emphasis text on inverted or primary sections.",
    );
  }

  const repairs = issues.filter((issue) => issue.severity === "warning").slice(0, 8);

  if (repairs.length > 0) {
    lines.push(
      "These parts were dropped or repaired during generation and need to be written properly:",
      ...repairs.map(
        (issue) =>
          `- ${issue.pageId ?? ""}${issue.elementKey ? `/${issue.elementKey}` : ""}: ${issue.message}`,
      ),
    );
  }

  return lines.join("\n");
}
