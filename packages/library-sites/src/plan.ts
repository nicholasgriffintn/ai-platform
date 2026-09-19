import {
  DEFAULT_SITE_THEME,
  decisionNoulConfidence,
  decisionNoulIsTrue,
  roundDecisionScore,
  SITE_KINDS,
  SITE_PALETTES,
  SITE_TONES,
  type DecisionAnswer,
  type DecisionChoiceQuestion,
  type DecisionNoulQuestion,
  type DecisionScoreQuestion,
  type ModelTier,
  type SiteKind,
  type SitePalette,
  type SitePlan,
  type SiteScope,
  type SiteTheme,
  type SiteTone,
} from "@ngriffin_uk/polychat-schemas";

export const SITE_PLAN_QUESTIONS = {
  kind: {
    type: "choice",
    instructions:
      "What kind of thing is the brief asking for? Pick the closest match for the whole request, not a single section.",
    criteria: {
      landing: "A single-page landing page selling one product, service or idea.",
      marketing:
        "A multi-page marketing site with several destinations such as pricing, about or contact.",
      portfolio: "A personal or studio portfolio showing work, writing or a CV.",
      dashboard: "An internal tool or analytics screen with metrics, tables and charts.",
      app: "An application interface with navigation, forms and records to manage.",
      form: "A single form, survey, signup or checkout flow.",
      docs: "Documentation, a help centre or a knowledge base.",
      component: "One reusable UI component or section rather than a page.",
    },
  } satisfies DecisionChoiceQuestion,
  scope: {
    type: "choice",
    instructions: "How much should be built?",
    criteria: {
      component: "A single component or section.",
      page: "One complete page.",
      site: "Several pages that link to each other.",
    },
  } satisfies DecisionChoiceQuestion,
  complexity: {
    type: "score",
    instructions:
      "How demanding is the brief? Consider the amount of content, the number of distinct sections or pages, and how much interaction or data it needs.",
    criteria: [
      "Trivial: one section with little copy.",
      "Simple: a short page with a few standard sections.",
      "Moderate: a full page with rich copy or several pages.",
      "Demanding: many pages, data-heavy views or detailed interactions.",
    ],
  } satisfies DecisionScoreQuestion,
  tone: {
    type: "choice",
    instructions: "Which voice suits the brief and its audience?",
    criteria: {
      plain: "Clear and unadorned.",
      friendly: "Warm and conversational.",
      bold: "Confident, punchy, short sentences.",
      editorial: "Considered, longer-form, magazine-like.",
      technical: "Precise, for developers or specialists.",
    },
  } satisfies DecisionChoiceQuestion,
  palette: {
    type: "choice",
    instructions:
      "Which colour palette fits the brief? If the brief names a colour, choose the palette closest to it.",
    criteria: {
      neutral: "Greys with a near-black accent. Safe default for tools.",
      slate: "Cool blue-greys with an indigo accent.",
      ocean: "Blue accent, fresh and trustworthy.",
      forest: "Green accent, natural or sustainable.",
      sunset: "Warm orange accent, energetic.",
      berry: "Pink and magenta accent, playful or fashion.",
      sand: "Warm beige and olive, calm and crafted.",
      midnight: "Deep purple accent, premium or nightlife.",
    },
  } satisfies DecisionChoiceQuestion,
  dark: {
    type: "noul",
    instructions:
      "Should the site default to a dark colour scheme? True only when the brief asks for dark mode or the subject clearly suits it (nightlife, gaming, developer tools).",
  } satisfies DecisionNoulQuestion,
  serif: {
    type: "noul",
    instructions:
      "Should headings use a serif typeface? True for editorial, luxury, hospitality, personal or literary briefs; false for products, tools and technical work.",
  } satisfies DecisionNoulQuestion,
  interactive: {
    type: "noul",
    instructions:
      "Does the result need live interaction such as filters, tabs, forms that validate or data that updates, beyond static content?",
  } satisfies DecisionNoulQuestion,
} as const;

export type SitePlanQuestions = typeof SITE_PLAN_QUESTIONS;
export type SitePlanAnswers = Partial<Record<keyof SitePlanQuestions, DecisionAnswer>>;

const TIER_BY_COMPLEXITY: readonly ModelTier[] = ["low", "low", "medium", "high"];

const SINGLE_PAGE_KINDS = new Set<SiteKind>(["landing", "form", "component", "dashboard"]);

function pickChoice<T extends string>(
  answer: DecisionAnswer | undefined,
  options: readonly T[],
  fallback: T,
): T {
  if (answer?.type === "choice" && (options as readonly string[]).includes(answer.choice)) {
    return answer.choice as T;
  }

  return fallback;
}

function readConfidence(answer: DecisionAnswer | undefined): number | null {
  if (!answer) {
    return null;
  }

  if (answer.type === "noul") {
    return decisionNoulConfidence(answer);
  }

  return answer.confidence;
}

export function buildSitePlanState(prompt: string, themeHint?: Partial<SiteTheme>) {
  return {
    brief: prompt,
    ...(themeHint && Object.keys(themeHint).length > 0 ? { requestedTheme: themeHint } : {}),
  };
}

export interface ResolveSitePlanOptions {
  prompt: string;
  answers?: SitePlanAnswers;
  themeHint?: Partial<SiteTheme>;
  provider?: string;
  model?: string;
}

function heuristicKind(prompt: string): SiteKind {
  const text = prompt.toLowerCase();

  if (/\b(dashboard|analytics|admin|metrics|kpi)\b/.test(text)) {
    return "dashboard";
  }

  if (/\b(docs|documentation|help cent|knowledge base)\b/.test(text)) {
    return "docs";
  }

  if (/\b(portfolio|my work|cv|resume)\b/.test(text)) {
    return "portfolio";
  }

  if (/\b(form|survey|signup|sign-up|checkout|questionnaire)\b/.test(text)) {
    return "form";
  }

  if (/\b(component|section|widget|card|navbar|footer)\b/.test(text)) {
    return "component";
  }

  if (/\b(pages|multi-page|about page|pricing page|contact page)\b/.test(text)) {
    return "marketing";
  }

  if (/\b(app|tool|crud|manage|inventory|crm)\b/.test(text)) {
    return "app";
  }

  return "landing";
}

function heuristicScope(kind: SiteKind, prompt: string): SiteScope {
  if (kind === "component") {
    return "component";
  }

  if (kind === "marketing" || kind === "docs" || /\bpages\b/.test(prompt.toLowerCase())) {
    return "site";
  }

  return "page";
}

export function resolveSitePlan({
  prompt,
  answers = {},
  themeHint,
  provider,
  model,
}: ResolveSitePlanOptions): SitePlan {
  const decided = Object.keys(answers).length > 0;
  const kind = decided
    ? pickChoice(answers.kind, SITE_KINDS, heuristicKind(prompt))
    : heuristicKind(prompt);
  const scopeFallback = heuristicScope(kind, prompt);
  let scope: SiteScope = decided
    ? pickChoice(answers.scope, ["component", "page", "site"] as const, scopeFallback)
    : scopeFallback;

  if (kind === "component") {
    scope = "component";
  } else if (scope === "component") {
    scope = "page";
  } else if (scope === "site" && SINGLE_PAGE_KINDS.has(kind) && kind !== "dashboard") {
    scope = "page";
  }

  const complexityIndex =
    answers.complexity?.type === "score"
      ? roundDecisionScore(answers.complexity)
      : scope === "site"
        ? 2
        : scope === "component"
          ? 0
          : 1;
  const tier = TIER_BY_COMPLEXITY[Math.min(complexityIndex, TIER_BY_COMPLEXITY.length - 1)];
  const tone: SiteTone = pickChoice(
    answers.tone,
    SITE_TONES,
    kind === "dashboard" || kind === "app" || kind === "docs" ? "plain" : "friendly",
  );
  const palette: SitePalette = pickChoice(
    answers.palette,
    SITE_PALETTES,
    kind === "dashboard" || kind === "app" ? "slate" : "neutral",
  );
  const dark = answers.dark?.type === "noul" ? decisionNoulIsTrue(answers.dark) : false;
  const serif = answers.serif?.type === "noul" ? decisionNoulIsTrue(answers.serif) : false;
  const interactive =
    answers.interactive?.type === "noul"
      ? decisionNoulIsTrue(answers.interactive)
      : kind === "dashboard" || kind === "app" || kind === "form";
  const theme: SiteTheme = {
    palette: themeHint?.palette ?? palette,
    font: themeHint?.font ?? (serif ? "display" : kind === "docs" ? "sans" : "sans"),
    radius: themeHint?.radius ?? (kind === "dashboard" || kind === "app" ? "sm" : "md"),
    mode: themeHint?.mode ?? (dark ? "dark" : DEFAULT_SITE_THEME.mode),
  };
  const confidences = Object.values(answers)
    .map(readConfidence)
    .filter((value): value is number => value !== null);
  const confidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : 0;

  return {
    kind,
    scope,
    tier,
    tone,
    theme,
    interactive,
    confidence,
    ...(decided ? { answers } : {}),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  };
}
