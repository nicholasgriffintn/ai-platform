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
