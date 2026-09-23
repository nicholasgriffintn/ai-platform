import type {
  DecisionAnswer,
  DecisionQuestion,
  SiteDecisionStage,
  SiteDecisionTraceEntry,
  SitePlan,
  SiteQuality,
  SiteRefineIntent,
} from "@ngriffin_uk/polychat-schemas";

const KIND_LABELS: Record<SitePlan["kind"], string> = {
  landing: "Landing page",
  marketing: "Marketing site",
  portfolio: "Portfolio",
  dashboard: "Dashboard",
  app: "Application",
  form: "Form",
  docs: "Documentation",
  component: "Component",
  commerce: "Commerce",
  booking: "Booking",
  event: "Event",
  publication: "Publication",
  community: "Community",
  education: "Education",
  "ai-tool": "AI tool",
  game: "Game",
};

const SCOPE_LABELS: Record<SitePlan["scope"], string> = {
  component: "one component",
  page: "one page",
  site: "several pages",
};

export interface CreateSiteDecisionTraceOptions {
  id: string;
  stage: SiteDecisionStage;
  source: SiteDecisionTraceEntry["source"];
  summary: string;
  effects: string[];
  questions: Readonly<Record<string, DecisionQuestion>>;
  answers?: Readonly<Record<string, DecisionAnswer>>;
  provider?: string;
  model?: string;
  durationMs?: number;
  createdAt?: string;
}

export function createSiteDecisionTrace({
  id,
  stage,
  source,
  summary,
  effects,
  questions,
  answers = {},
  provider,
  model,
  durationMs,
  createdAt = new Date().toISOString(),
}: CreateSiteDecisionTraceOptions): SiteDecisionTraceEntry {
  return {
    kind: "decision",
    version: 1,
    id,
    stage,
    source,
    summary,
    effects,
    questions: Object.entries(questions).map(([questionId, question]) => ({
      id: questionId,
      question,
      ...(answers[questionId] ? { answer: answers[questionId] } : {}),
    })),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(durationMs === undefined ? {} : { durationMs }),
    createdAt,
  };
}

export function describeSitePlanDecision(plan: SitePlan) {
  return {
    summary: `${KIND_LABELS[plan.kind]}, ${SCOPE_LABELS[plan.scope]}`,
    effects: [
      `Use the ${plan.tier} coding tier`,
      `Write in a ${plan.tone} voice`,
      `Use a ${plan.theme.direction} direction with ${plan.theme.density} density`,
      `Use the ${plan.theme.palette} palette, ${plan.theme.texture} texture and ${plan.theme.font} type`,
      `${plan.interactive ? "Include" : "Do not require"} interactive behaviour`,
      `Support ${plan.capabilities.join(", ")}`,
    ],
  };
}

export function describeSiteRefinementDecision({
  intent,
  tier,
  target,
}: {
  intent: SiteRefineIntent;
  tier: SitePlan["tier"];
  target: { pageId: string; elementKey: string } | null;
}) {
  const intentLabel: Record<SiteRefineIntent, string> = {
    tweak: "Targeted tweak",
    restructure: "Structural change",
    page: "Page-level change",
    theme: "Whole-site theme change",
  };

  return {
    summary: target
      ? `${intentLabel[intent]} for ${target.pageId}/${target.elementKey}`
      : `${intentLabel[intent]} across the site`,
    effects: [
      `Use the ${tier} coding tier`,
      target
        ? `Limit the coding context to ${target.pageId}/${target.elementKey}`
        : "Give the coding model the whole site",
    ],
  };
}

export function describeSiteQualityDecision(quality: SiteQuality | null) {
  if (!quality) {
    return {
      summary: "Quality review was unavailable",
      effects: ["Keep the validated coding-model result without an automatic repair"],
    };
  }

  return {
    summary: quality.needsRepair
      ? `Repair recommended with ${Math.round((quality.repairConfidence ?? 0) * 100)}% confidence`
      : `Quality review passed at ${Math.round(quality.coverage * 100)}% brief coverage`,
    effects: [
      `${Math.round(quality.coverage * 100)}% brief coverage`,
      `${Math.round(quality.placeholders * 100)}% placeholder probability`,
      `${Math.round(quality.coherent * 100)}% cross-page coherence`,
      `${Math.round((quality.readable ?? 1) * 100)}% visual readability`,
      quality.needsRepair ? "Request a repair when confidence is high" : "Keep the result",
    ],
  };
}
