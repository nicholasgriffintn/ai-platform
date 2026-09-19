import {
  DEFAULT_SITE_THEME,
  decisionChoiceSelection,
  decisionNoulConfidence,
  decisionNoulIsTrue,
  roundDecisionScore,
  SITE_KINDS,
  SITE_DESIGN_DIRECTIONS,
  SITE_DENSITIES,
  SITE_MOTION_LEVELS,
  SITE_PALETTES,
  SITE_TEXTURES,
  SITE_TONES,
  type DecisionAnswer,
  type DecisionChoiceQuestion,
  type DecisionNoulQuestion,
  type DecisionScoreQuestion,
  type ModelTier,
  type SiteKind,
  type SiteCapability,
  type SiteDensity,
  type SiteDesignDirection,
  type SiteMotionLevel,
  type SitePalette,
  type SitePlan,
  type SiteScope,
  type SiteTheme,
  type SiteTexture,
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
      commerce: "A store, product catalogue, cart or checkout experience.",
      booking: "Appointments, reservations, availability or service scheduling.",
      event: "A conference, festival or event with programme, speakers or tickets.",
      publication: "A blog, magazine, news site or editorial archive.",
      community: "A member community, forum, social space or directory.",
      education: "A course, learning product, tutorial or training experience.",
      "ai-tool": "An AI-powered workflow, assistant, generator or playground.",
      game: "A game, quiz, puzzle or playful interactive experience.",
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
  direction: {
    type: "choice",
    instructions:
      "Which visual direction best fits the audience, subject and requested references? Choose a committed art direction, not a generic safe default.",
    criteria: {
      minimal: "Reduced, quiet and precise with generous negative space.",
      editorial: "Magazine-like hierarchy, expressive type and asymmetric composition.",
      utilitarian: "Dense, direct and task-focused with visible structure.",
      brutalist: "Raw contrast, hard edges, oversized type and intentionally exposed structure.",
      playful: "Bright, friendly, rounded and characterful with energetic composition.",
      luxury: "Restrained, high-contrast and typographically led with deliberate whitespace.",
      organic: "Tactile, warm and natural with soft shapes and irregular rhythm.",
      retro: "Period-inspired colour, typography and graphic motifs without pastiche copy.",
      futuristic: "Technical, luminous and spatial with controlled depth and glow.",
      maximalist: "Layered, expressive and visually dense while retaining clear hierarchy.",
    },
  } satisfies DecisionChoiceQuestion,
  density: {
    type: "choice",
    instructions: "How dense should the interface feel?",
    criteria: {
      compact: "Information-rich tools, tables and operational screens.",
      comfortable: "Balanced spacing suitable for most products and sites.",
      spacious: "Large-scale editorial, premium or image-led presentation.",
    },
  } satisfies DecisionChoiceQuestion,
  texture: {
    type: "choice",
    instructions: "Which background treatment supports the direction?",
    criteria: {
      clean: "Mostly solid surfaces with minimal decoration.",
      grain: "Subtle tactile noise for print, craft or editorial work.",
      grid: "Visible structural grid for technical or utilitarian interfaces.",
      gradient: "Layered colour fields for expressive product presentation.",
      glow: "Luminous depth for futuristic, gaming or AI experiences.",
    },
  } satisfies DecisionChoiceQuestion,
  motion: {
    type: "choice",
    instructions: "How much purposeful motion should the experience use?",
    criteria: {
      none: "No decorative motion; use for serious or highly constrained experiences.",
      restrained: "Short transitions and a small number of entrance moments.",
      expressive: "Visible staged entrances and transforms that support the concept.",
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

const DIRECTION_BY_KIND: Record<SiteKind, SiteDesignDirection> = {
  landing: "minimal",
  marketing: "minimal",
  portfolio: "editorial",
  dashboard: "utilitarian",
  app: "utilitarian",
  form: "minimal",
  docs: "utilitarian",
  component: "minimal",
  commerce: "playful",
  booking: "organic",
  event: "maximalist",
  publication: "editorial",
  community: "playful",
  education: "organic",
  "ai-tool": "futuristic",
  game: "retro",
};

const PALETTE_BY_KIND: Record<SiteKind, SitePalette> = {
  landing: "neutral",
  marketing: "neutral",
  portfolio: "sand",
  dashboard: "slate",
  app: "slate",
  form: "neutral",
  docs: "slate",
  component: "neutral",
  commerce: "berry",
  booking: "forest",
  event: "sunset",
  publication: "sand",
  community: "ocean",
  education: "forest",
  "ai-tool": "midnight",
  game: "berry",
};

const SINGLE_PAGE_KINDS = new Set<SiteKind>(["landing", "form", "component", "dashboard"]);

function pickChoice<T extends string>(
  answer: DecisionAnswer | undefined,
  options: readonly T[],
  fallback: T,
): T {
  if (answer?.type === "choice") {
    const choice = decisionChoiceSelection(answer);

    if ((options as readonly string[]).includes(choice)) {
      return choice as T;
    }
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

  if (/\b(shop|store|commerce|e-?commerce|product catalogue|cart|checkout)\b/.test(text)) {
    return "commerce";
  }

  if (/\b(book|booking|reservation|appointment|availability)\b/.test(text)) {
    return "booking";
  }

  if (/\b(conference|festival|event|schedule|speakers?|tickets?)\b/.test(text)) {
    return "event";
  }

  if (/\b(blog|magazine|publication|news|journal)\b/.test(text)) {
    return "publication";
  }

  if (/\b(course|learning|lesson|education|training)\b/.test(text)) {
    return "education";
  }

  if (/\b(community|forum|members?|social network|directory)\b/.test(text)) {
    return "community";
  }

  if (/\b(ai tool|assistant|copilot|generator|playground)\b/.test(text)) {
    return "ai-tool";
  }

  if (/\b(game|quiz|puzzle|arcade)\b/.test(text)) {
    return "game";
  }

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

  if (
    [
      "marketing",
      "docs",
      "commerce",
      "booking",
      "event",
      "publication",
      "community",
      "education",
    ].includes(kind) ||
    /\bpages\b/.test(prompt.toLowerCase())
  ) {
    return "site";
  }

  return "page";
}

function inferCapabilities(kind: SiteKind, prompt: string, interactive: boolean): SiteCapability[] {
  const text = prompt.toLowerCase();
  const capabilities = new Set<SiteCapability>(["content", "navigation"]);
  const include = (pattern: RegExp, capability: SiteCapability) => {
    if (pattern.test(text)) {
      capabilities.add(capability);
    }
  };

  if (interactive) {
    capabilities.add("forms");
  }

  if (["dashboard", "app", "ai-tool"].includes(kind)) {
    capabilities.add("visualisation");
  }

  if (kind === "commerce") {
    capabilities.add("commerce");
    capabilities.add("payments");
  }

  if (kind === "booking" || kind === "event") {
    capabilities.add("booking");
  }

  include(/\b(search|find|lookup)\b/, "search");
  include(/\b(filters?|sorting?|segments?)\b/, "filtering");
  include(/\b(crud|create|edit|delete|manage|admin)\b/, "crud");
  include(/\b(auth|login|log in|sign in|accounts?|profiles?)\b/, "authentication");
  include(/\b(upload|attachment|file|document)\b/, "files");
  include(/\b(ai|assistant|copilot|model|generate)\b/, "ai");
  include(/\b(realtime|real-time|live|websocket|collaborat)\b/, "realtime");
  include(/\b(payment|checkout|subscription|billing)\b/, "payments");

  return [...capabilities];
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
  const palette: SitePalette = pickChoice(answers.palette, SITE_PALETTES, PALETTE_BY_KIND[kind]);
  const dark =
    answers.dark?.type === "noul"
      ? decisionNoulIsTrue(answers.dark)
      : /\b(dark|night|noir|neon)\b/i.test(prompt) || kind === "ai-tool";
  const serif = answers.serif?.type === "noul" ? decisionNoulIsTrue(answers.serif) : false;
  const interactive =
    answers.interactive?.type === "noul"
      ? decisionNoulIsTrue(answers.interactive)
      : kind === "dashboard" || kind === "app" || kind === "form";
  const direction: SiteDesignDirection = pickChoice(
    answers.direction,
    SITE_DESIGN_DIRECTIONS,
    DIRECTION_BY_KIND[kind],
  );
  const density: SiteDensity = pickChoice(
    answers.density,
    SITE_DENSITIES,
    kind === "dashboard" || kind === "app"
      ? "compact"
      : direction === "luxury"
        ? "spacious"
        : "comfortable",
  );
  const texture: SiteTexture = pickChoice(
    answers.texture,
    SITE_TEXTURES,
    direction === "editorial" || direction === "organic"
      ? "grain"
      : direction === "futuristic"
        ? "glow"
        : direction === "utilitarian"
          ? "grid"
          : "clean",
  );
  const motion: SiteMotionLevel = pickChoice(
    answers.motion,
    SITE_MOTION_LEVELS,
    direction === "playful" || direction === "futuristic" || direction === "maximalist"
      ? "expressive"
      : "restrained",
  );
  const capabilities = inferCapabilities(kind, prompt, interactive);
  const theme: SiteTheme = {
    palette: themeHint?.palette ?? palette,
    font:
      themeHint?.font ??
      (serif || direction === "editorial" || direction === "luxury" ? "display" : "sans"),
    radius:
      themeHint?.radius ??
      (direction === "brutalist" ? "none" : direction === "playful" ? "lg" : "md"),
    mode: themeHint?.mode ?? (dark ? "dark" : DEFAULT_SITE_THEME.mode),
    direction: themeHint?.direction ?? direction,
    density: themeHint?.density ?? density,
    texture: themeHint?.texture ?? texture,
    motion: themeHint?.motion ?? motion,
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
    capabilities,
    confidence,
    ...(decided ? { answers } : {}),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  };
}
