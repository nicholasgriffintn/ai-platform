import { platformTeammateId, type PlatformTeammateCategory } from "./platform-teammates.js";
import {
  PROJECT_FLOW_MAX_STAGES,
  type ProjectFlow,
  type ProjectFlowStage,
} from "./project-tasks.js";

export interface ProjectWorkflow {
  slug: string;
  name: string;
  summary: string;
  category: PlatformTeammateCategory;
  stages: readonly ProjectFlowStage[];
}

/**
 * Ordered phases a project can start from in the flow editor. Applying a workflow copies its
 * stages into the project flow, where every phase stays editable, and the flow engine executes
 * them like any other stage.
 */
export const PROJECT_WORKFLOWS: readonly ProjectWorkflow[] = [
  {
    slug: "architecture-discovery",
    name: "Architecture discovery",
    summary:
      "Map a capability across systems, ownership and decisions, then pressure-test the map.",
    category: "engineering",
    stages: [
      {
        id: "scope",
        name: "Scope the capability",
        instructions:
          "Agree exactly which capability is being investigated, what would count as an answer and which sources are in bounds.",
        teammateId: platformTeammateId("architecture-discovery"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "discover",
        name: "Map the estate",
        instructions:
          "Map the systems that implement the capability, their owners and the decisions that constrain them. Cite a source for every claim and list what could not be verified.",
        teammateId: platformTeammateId("architecture-discovery"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "challenge",
        name: "Pressure-test the map",
        instructions:
          "Check the map against dependencies, current delivery work and recent decisions. Flag anything the map gets wrong or leaves open before it is used.",
        teammateId: platformTeammateId("change-impact"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "change-impact",
    name: "Change impact",
    summary: "Assess a proposed change across services, teams and delivery work before committing.",
    category: "engineering",
    stages: [
      {
        id: "brief",
        name: "Gather the change brief",
        instructions:
          "Establish what is changing, what is explicitly out of scope and which systems and teams are likely to be touched.",
        teammateId: platformTeammateId("architecture-discovery"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "assess",
        name: "Assess the impact",
        instructions:
          "Assess the likely effect across services, dependencies, teams and current delivery work. Rank by confidence and consequence, and name what needs coordination before implementation.",
        teammateId: platformTeammateId("change-impact"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
      {
        id: "coordinate",
        name: "Plan the coordination",
        instructions:
          "Turn the accepted impact assessment into a short coordination plan with owners and checks that would confirm each assumption.",
        teammateId: platformTeammateId("engineering-planning"),
        skillIds: [],
        mode: "plan",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "incident-response",
    name: "Incident response",
    summary:
      "Triage an incident, establish the blast radius, coordinate the response and capture it.",
    category: "engineering",
    stages: [
      {
        id: "triage",
        name: "Triage",
        instructions:
          "State what is known, what has changed and which action needs an owner. Prefer the relevant runbook's wording over your own.",
        teammateId: platformTeammateId("incident-coordination"),
        skillIds: [],
        mode: "chat",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "impact",
        name: "Establish the blast radius",
        instructions:
          "Identify the services, teams and current work affected, with the evidence for each. Keep it to what would change the response.",
        teammateId: platformTeammateId("change-impact"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "coordinate",
        name: "Coordinate the response",
        instructions:
          "Keep a current view of actions, owners and blockers. Anything that writes to another system or communicates externally waits for explicit approval.",
        teammateId: platformTeammateId("incident-coordination"),
        skillIds: [],
        mode: "chat",
        requiresApprovalFor: ["network", "write"],
        advance: "on_human_accept",
      },
      {
        id: "capture",
        name: "Capture the outcome",
        instructions:
          "Record the timeline, the decisions taken and the open follow-ups, with links to the sources.",
        teammateId: platformTeammateId("knowledge-navigation"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "engineering-planning",
    name: "Engineering plan",
    summary: "Turn delivery work, dependencies and constraints into a checkable plan.",
    category: "engineering",
    stages: [
      {
        id: "constraints",
        name: "Gather constraints",
        instructions:
          "Collect the architecture constraints, ownership and prior decisions the plan has to respect, with sources.",
        teammateId: platformTeammateId("architecture-discovery"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "plan",
        name: "Draft the plan",
        instructions:
          "Break the work into stages that each produce something checkable. Name the evidence that shows a stage is done, the dependencies and the decisions needed before work starts.",
        teammateId: platformTeammateId("engineering-planning"),
        skillIds: [],
        mode: "plan",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
      {
        id: "validate",
        name: "Check the plan",
        instructions:
          "Test the plan against dependencies, current delivery work and constraints. Report conflicts and anything the plan assumes without evidence.",
        teammateId: platformTeammateId("change-impact"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "market-research",
    name: "Market research",
    summary: "Gather market evidence, compare it with priorities and keep the sources.",
    category: "product",
    stages: [
      {
        id: "frame",
        name: "Frame the question",
        instructions:
          "Agree the question, the sources that count as evidence and what would make the answer decision-ready.",
        teammateId: platformTeammateId("market-research"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "gather",
        name: "Gather the evidence",
        instructions:
          "Collect evidence from approved internal and external sources. Keep figures with their date and origin and preserve the sources.",
        teammateId: platformTeammateId("market-research"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "compare",
        name: "Compare and challenge",
        instructions:
          "Compare the evidence with current product priorities, identify conflicts and weak points, and give a short answer before the supporting detail.",
        teammateId: platformTeammateId("research"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "feature-opportunity",
    name: "Feature opportunity",
    summary: "Combine market evidence, audience needs and constraints into testable options.",
    category: "product",
    stages: [
      {
        id: "evidence",
        name: "Collect the evidence",
        instructions:
          "Gather market evidence, audience needs, analytics and existing journey information, with sources.",
        teammateId: platformTeammateId("market-research"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "opportunity",
        name: "Shape the options",
        instructions:
          "Combine the evidence with existing platform constraints and propose options. State what the evidence supports, what it does not and what would need testing.",
        teammateId: platformTeammateId("feature-opportunity"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "validate",
        name: "Choose the tests",
        instructions:
          "Turn the chosen option into the smallest set of tests that would raise or lower confidence, and say what each result would mean.",
        teammateId: platformTeammateId("product-evidence"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "prototype-support",
    name: "Prototype support",
    summary: "Build or assess an early prototype against the design system and real constraints.",
    category: "product",
    stages: [
      {
        id: "constraints",
        name: "Gather constraints",
        instructions:
          "Retrieve the design system components, product constraints and journey information the prototype has to respect.",
        teammateId: platformTeammateId("prototype-support"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "build",
        name: "Build the prototype",
        instructions:
          "Build the smallest prototype that answers the question. Show the result rather than describing it, and keep it disposable.",
        teammateId: platformTeammateId("prototype-support"),
        skillIds: [],
        mode: "build",
        requiresApprovalFor: ["sandbox"],
        advance: "on_goal_complete",
      },
      {
        id: "assess",
        name: "Assess the prototype",
        instructions:
          "State what the prototype does and does not prove, what it assumes and what would need testing next.",
        teammateId: platformTeammateId("product-evidence"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "product-evidence",
    name: "Product evidence trail",
    summary: "Connect a proposal to the research, analytics and assumptions behind it.",
    category: "product",
    stages: [
      {
        id: "gather",
        name: "Gather supporting material",
        instructions:
          "Collect the research, analytics and decisions the proposal relies on, with links to the sources.",
        teammateId: platformTeammateId("market-research"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "trace",
        name: "Build the evidence trail",
        instructions:
          "Connect the proposal to the evidence: what is known, what is assumed, where confidence is high and where more learning is needed.",
        teammateId: platformTeammateId("product-evidence"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "challenge",
        name: "Challenge the case",
        instructions:
          "Look for the strongest objection to the proposal and the evidence that would settle it. Say plainly where confidence is not justified.",
        teammateId: platformTeammateId("research"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "delivery-planning",
    name: "Delivery planning",
    summary: "Produce a sourced view of delivery risk, unresolved decisions and dependencies.",
    category: "organisation",
    stages: [
      {
        id: "discover",
        name: "Map current work",
        instructions:
          "Map the work, ownership and dependencies in play from the connected sources, and name anything the sources do not cover.",
        teammateId: platformTeammateId("architecture-discovery"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "dependencies",
        name: "Surface dependencies and risk",
        instructions:
          "Produce a current, sourced view of delivery risk, unresolved decisions and dependencies. Name the owner and the decision needed for each item.",
        teammateId: platformTeammateId("delivery-planning"),
        skillIds: [],
        mode: "plan",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "plan",
        name: "Agree the plan",
        instructions:
          "Turn the accepted picture into a short plan with owners, sequence and the checks that would show progress.",
        teammateId: platformTeammateId("engineering-planning"),
        skillIds: [],
        mode: "plan",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "research",
    name: "Research",
    summary: "Gather and compare evidence from a defined set of sources, with a sourced brief.",
    category: "organisation",
    stages: [
      {
        id: "frame",
        name: "Frame the question and sources",
        instructions:
          "Agree the question and the exact set of internal and external sources in scope. Say when a question falls outside it.",
        teammateId: platformTeammateId("research"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "gather",
        name: "Gather and compare",
        instructions:
          "Gather and compare the evidence. Quote figures with their date and origin, separate what the sources say from what you infer, and flag conflicts.",
        teammateId: platformTeammateId("research"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "brief",
        name: "Brief the findings",
        instructions:
          "Give a short answer first, then the supporting detail with links back to the sources.",
        teammateId: platformTeammateId("knowledge-navigation"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "knowledge-navigation",
    name: "Knowledge navigation",
    summary: "Answer questions across connected knowledge, with links back to the source material.",
    category: "organisation",
    stages: [
      {
        id: "locate",
        name: "Locate the sources",
        instructions:
          "Find the sources and relationships relevant to the question. Say which knowledge is connected and which is not.",
        teammateId: platformTeammateId("knowledge-navigation"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "answer",
        name: "Answer with sources",
        instructions:
          "Answer the question with a link back to the source for every important claim. Where the knowledge does not contain an answer, say so.",
        teammateId: platformTeammateId("knowledge-navigation"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_human_accept",
      },
    ],
  },
  {
    slug: "support",
    name: "Support case",
    summary: "Gather customer and service context, diagnose, then respond with approval.",
    category: "organisation",
    stages: [
      {
        id: "context",
        name: "Gather the context",
        instructions:
          "Combine support knowledge and the relevant service or customer context. Check what is already known before asking for it again.",
        teammateId: platformTeammateId("support"),
        skillIds: [],
        mode: "chat",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "diagnose",
        name: "Diagnose",
        instructions:
          "Establish the likely cause and the evidence for it. Name what would confirm or rule out each possibility.",
        teammateId: platformTeammateId("knowledge-navigation"),
        skillIds: [],
        mode: "explore",
        requiresApprovalFor: [],
        advance: "on_goal_complete",
      },
      {
        id: "respond",
        name: "Respond",
        instructions:
          "Draft the response and the follow-up actions. Anything that contacts a customer or writes to another system waits for approval.",
        teammateId: platformTeammateId("support"),
        skillIds: [],
        mode: "chat",
        requiresApprovalFor: ["network", "write"],
        advance: "on_human_accept",
      },
    ],
  },
];

export function findProjectWorkflow(slug: string | null | undefined): ProjectWorkflow | undefined {
  if (!slug) {
    return undefined;
  }

  return PROJECT_WORKFLOWS.find((workflow) => workflow.slug === slug);
}

export function createProjectFlowFromWorkflow(slug: string): ProjectFlow | null {
  const workflow = findProjectWorkflow(slug);

  if (!workflow || workflow.stages.length > PROJECT_FLOW_MAX_STAGES) {
    return null;
  }

  return { stages: workflow.stages.map((entry) => ({ ...entry, skillIds: [...entry.skillIds] })) };
}
