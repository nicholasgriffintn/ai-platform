import type { AgentMode } from "./agent-modes.js";
import type { TeammateKind } from "./teammate-roles.js";

export const PLATFORM_TEAMMATE_ID_PREFIX = "platform-";

export const PLATFORM_TEAMMATE_SCOPE_ID = "platform";

export const PLATFORM_TEAMMATE_AUTHOR_USER_ID = -1;

export const PLATFORM_TEAMMATE_CATEGORIES = ["engineering", "product", "organisation"] as const;

export type PlatformTeammateCategory = (typeof PLATFORM_TEAMMATE_CATEGORIES)[number];

export const platformTeammateCategoryLabels: Record<PlatformTeammateCategory, string> = {
  engineering: "Engineering",
  product: "Product and market",
  organisation: "Organisation",
};

export interface PlatformTeammate {
  id: string;
  slug: string;
  name: string;
  category: PlatformTeammateCategory;
  summary: string;
  tools: readonly string[];
  skillIds: readonly string[];
  mode: AgentMode;
  kind: TeammateKind;
  maxSteps: number;
}

export function platformTeammateId(slug: string): string {
  return `${PLATFORM_TEAMMATE_ID_PREFIX}${slug}`;
}

export const PLATFORM_TEAMMATES: readonly PlatformTeammate[] = [
  {
    id: platformTeammateId("architecture-discovery"),
    slug: "architecture-discovery",
    name: "Architecture Discovery",
    category: "engineering",
    summary:
      "Maps which systems implement a capability, who owns them and what constrains a change.",
    tools: [
      "search_documents",
      "research",
      "extract_content",
      "web_search",
      "create_note",
      "discover_capabilities",
    ],
    skillIds: ["document-research"],
    mode: "explore",
    kind: "colleague",
    maxSteps: 32,
  },
  {
    id: platformTeammateId("change-impact"),
    slug: "change-impact",
    name: "Change Impact",
    category: "engineering",
    summary: "Assesses the likely effect of a platform change before anyone commits to it.",
    tools: [
      "search_documents",
      "research",
      "extract_content",
      "get_task",
      "list_tasks",
      "create_note",
      "second_opinion",
    ],
    skillIds: ["second-opinion"],
    mode: "explore",
    kind: "colleague",
    maxSteps: 32,
  },
  {
    id: platformTeammateId("incident-coordination"),
    slug: "incident-coordination",
    name: "Incident Coordination",
    category: "engineering",
    summary: "Keeps a current, owned view of an incident and what happens next.",
    tools: [
      "search_documents",
      "web_search",
      "extract_content",
      "create_note",
      "get_task",
      "list_tasks",
      "update_task",
      "request_approval",
    ],
    skillIds: ["structured-reasoning"],
    mode: "chat",
    kind: "colleague",
    maxSteps: 24,
  },
  {
    id: platformTeammateId("engineering-planning"),
    slug: "engineering-planning",
    name: "Engineering Planning",
    category: "engineering",
    summary: "Turns delivery work, dependencies and constraints into a sequence with owners.",
    tools: [
      "search_documents",
      "create_task",
      "list_tasks",
      "get_task",
      "update_task",
      "create_note",
    ],
    skillIds: ["task-decomposition"],
    mode: "plan",
    kind: "colleague",
    maxSteps: 32,
  },
  {
    id: platformTeammateId("market-research"),
    slug: "market-research",
    name: "Market Research",
    category: "product",
    summary: "Gathers market evidence, keeps the sources and says where it is weak.",
    tools: ["web_search", "research", "search_documents", "extract_content", "create_note"],
    skillIds: ["document-research"],
    mode: "explore",
    kind: "colleague",
    maxSteps: 28,
  },
  {
    id: platformTeammateId("feature-opportunity"),
    slug: "feature-opportunity",
    name: "Feature Opportunity",
    category: "product",
    summary: "Combines market evidence, audience needs and constraints into testable ideas.",
    tools: ["web_search", "research", "search_documents", "create_note", "list_tasks"],
    skillIds: ["structured-reasoning"],
    mode: "explore",
    kind: "colleague",
    maxSteps: 28,
  },
  {
    id: platformTeammateId("prototype-support"),
    slug: "prototype-support",
    name: "Prototype Support",
    category: "product",
    summary: "Builds or assesses an early prototype against the design system.",
    tools: [
      "search_documents",
      "v0_code_generation",
      "write_document",
      "capture_screenshot",
      "create_note",
    ],
    skillIds: ["artifacts"],
    mode: "build",
    kind: "colleague",
    maxSteps: 40,
  },
  {
    id: platformTeammateId("product-evidence"),
    slug: "product-evidence",
    name: "Product Evidence",
    category: "product",
    summary: "Connects a proposal to the research, analytics and assumptions behind it.",
    tools: [
      "search_documents",
      "research",
      "web_search",
      "extract_content",
      "create_note",
      "get_note",
    ],
    skillIds: ["document-research"],
    mode: "explore",
    kind: "colleague",
    maxSteps: 28,
  },
  {
    id: platformTeammateId("delivery-planning"),
    slug: "delivery-planning",
    name: "Delivery Planning",
    category: "organisation",
    summary: "Gives a sourced view of delivery risk, unresolved decisions and dependencies.",
    tools: [
      "create_task",
      "list_tasks",
      "get_task",
      "update_task",
      "search_documents",
      "create_note",
    ],
    skillIds: ["task-decomposition"],
    mode: "plan",
    kind: "colleague",
    maxSteps: 32,
  },
  {
    id: platformTeammateId("research"),
    slug: "research",
    name: "Research",
    category: "organisation",
    summary: "Gathers and compares evidence within a defined set of sources.",
    tools: ["web_search", "research", "extract_content", "search_documents", "create_note"],
    skillIds: ["document-research"],
    mode: "explore",
    kind: "colleague",
    maxSteps: 28,
  },
  {
    id: platformTeammateId("knowledge-navigation"),
    slug: "knowledge-navigation",
    name: "Knowledge Navigation",
    category: "organisation",
    summary: "Answers questions across connected knowledge, with links back to sources.",
    tools: ["search_documents", "get_note", "extract_content", "research", "create_note"],
    skillIds: ["document-research"],
    mode: "explore",
    kind: "colleague",
    maxSteps: 24,
  },
  {
    id: platformTeammateId("support"),
    slug: "support",
    name: "Support",
    category: "organisation",
    summary: "Combines support knowledge and customer context, with explicit actions.",
    tools: ["search_documents", "web_search", "get_note", "create_note", "request_approval"],
    skillIds: ["structured-reasoning"],
    mode: "chat",
    kind: "colleague",
    maxSteps: 24,
  },
];

export function isPlatformTeammateId(id: string): boolean {
  return id.startsWith(PLATFORM_TEAMMATE_ID_PREFIX);
}

export function findPlatformTeammate(
  idOrSlug: string | null | undefined,
): PlatformTeammate | undefined {
  if (!idOrSlug) {
    return undefined;
  }

  return PLATFORM_TEAMMATES.find(
    (teammate) => teammate.id === idOrSlug || teammate.slug === idOrSlug,
  );
}

export function listPlatformTeammateIds(): string[] {
  return PLATFORM_TEAMMATES.map((teammate) => teammate.id);
}
