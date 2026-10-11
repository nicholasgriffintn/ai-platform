import z from "zod/v4";

export const councilMemberIds = [
  "chair",
  "sceptic",
  "architect",
  "operator",
  "researcher",
  "ethicist",
  "strategist",
  "critic",
  "synthesiser",
  "security",
  "customer",
  "contrarian",
  "joker",
  "wildcard",
] as const;

export type CouncilMemberId = (typeof councilMemberIds)[number];

export interface CouncilMemberDefinition {
  id: CouncilMemberId;
  name: string;
  role: string;
  traits: readonly string[];
}

export const councilMembers = [
  {
    id: "chair",
    name: "Chair",
    role: "facilitator",
    traits: ["structured", "neutral", "decisive"],
  },
  {
    id: "sceptic",
    name: "Sceptic",
    role: "assumption tester",
    traits: ["precise", "doubtful", "evidence-led"],
  },
  {
    id: "architect",
    name: "Architect",
    role: "systems designer",
    traits: ["structural", "maintainable", "long-range"],
  },
  {
    id: "operator",
    name: "Operator",
    role: "execution lead",
    traits: ["practical", "sequenced", "delivery-focused"],
  },
  {
    id: "researcher",
    name: "Researcher",
    role: "evidence gatherer",
    traits: ["curious", "careful", "source-aware"],
  },
  {
    id: "ethicist",
    name: "Ethicist",
    role: "impact reviewer",
    traits: ["fair", "cautious", "human-centred"],
  },
  {
    id: "strategist",
    name: "Strategist",
    role: "trade-off mapper",
    traits: ["commercial", "prioritised", "goal-led"],
  },
  {
    id: "critic",
    name: "Critic",
    role: "quality reviewer",
    traits: ["blunt", "specific", "standards-driven"],
  },
  {
    id: "synthesiser",
    name: "Synthesiser",
    role: "consensus writer",
    traits: ["clear", "integrative", "concise"],
  },
  {
    id: "security",
    name: "Security",
    role: "risk analyst",
    traits: ["threat-aware", "defensive", "detail-oriented"],
  },
  {
    id: "customer",
    name: "Customer",
    role: "user advocate",
    traits: ["empathetic", "plain-spoken", "outcome-focused"],
  },
  {
    id: "contrarian",
    name: "Contrarian",
    role: "alternative finder",
    traits: ["independent", "creative", "anti-consensus"],
  },
  {
    id: "joker",
    name: "Joker",
    role: "chaos spark",
    traits: ["playful", "surprising", "provocative"],
  },
  {
    id: "wildcard",
    name: "Wildcard",
    role: "reframer",
    traits: ["unexpected", "analogical", "perspective-shifting"],
  },
] as const satisfies readonly CouncilMemberDefinition[];

export const defaultCouncilMemberIds = councilMemberIds;

export const COUNCIL_REVIEW_SEATS = ["sceptic", "researcher", "customer", "strategist"] as const;

export const COUNCIL_REVIEW_ADJUDICATOR = "synthesiser" as const;

export const councilReviewVerdictSchema = z.enum(["ship", "revise", "hold"]);

export type CouncilReviewVerdict = z.infer<typeof councilReviewVerdictSchema>;

export const councilReviewSeatSchema = z.object({
  memberId: z.enum(councilMemberIds),
  critique: z.string(),
  rebuttal: z.string(),
  vote: councilReviewVerdictSchema,
});

export type CouncilReviewSeat = z.infer<typeof councilReviewSeatSchema>;

export const councilReviewSchema = z.object({
  id: z.string().min(1),
  outputId: z.string().min(1),
  outputRevision: z.number().int().positive(),
  verdict: councilReviewVerdictSchema,
  brief: z.string(),
  dissent: z.array(z.string()),
  seats: z.array(councilReviewSeatSchema),
  createdAt: z.string(),
});

export type CouncilReview = z.infer<typeof councilReviewSchema>;

export const councilReviewListResponseSchema = z.object({
  reviews: z.array(councilReviewSchema),
});

export type CouncilReviewListResponse = z.infer<typeof councilReviewListResponseSchema>;

export const reviewOutputInputSchema = z.object({
  outputId: z.string().min(1).describe("The Output to review before it is sent or published."),
});
