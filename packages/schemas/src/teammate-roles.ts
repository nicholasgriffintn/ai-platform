import z from "zod/v4";

import type { AgentMode } from "./agent-modes.js";

export const TEAMMATE_KINDS = ["colleague", "bot"] as const;

export const teammateKindSchema = z.enum(TEAMMATE_KINDS);

export type TeammateKind = (typeof TEAMMATE_KINDS)[number];

export const DEFAULT_TEAMMATE_KIND: TeammateKind = "colleague";

export const TEAMMATE_PERMISSIONS_SENTENCE =
  "Reads run on their own. Anything that writes to another system waits for your approval.";

export function describeTeammateKind(kind: TeammateKind): string {
  return kind === "bot"
    ? "Runs unattended when invoked by a routine, channel or delegation, within its current grants."
    : "Works directly alongside you and can also be invoked for bounded background work.";
}

export const TEAMMATE_ROLE_CATEGORIES = [
  "Recommended",
  "Documentation",
  "Engineering",
  "Research",
  "Creative",
  "Bots",
] as const;

export type TeammateRoleCategory = (typeof TEAMMATE_ROLE_CATEGORIES)[number];

export interface TeammateRole {
  slug: string;
  title: string;
  category: TeammateRoleCategory;
  kind: TeammateKind;
  summary: string;
  suggestedTools: readonly string[];
  mode: AgentMode | null;
}

export const TEAMMATE_ROLES: readonly TeammateRole[] = [
  {
    slug: "research-analyst",
    title: "Research analyst",
    category: "Recommended",
    kind: "colleague",
    summary: "Reads widely, checks the sources and comes back with what holds up.",
    suggestedTools: [
      "web_search",
      "research",
      "extract_content",
      "search_documents",
      "create_note",
    ],
    mode: "explore",
  },
  {
    slug: "writing-partner",
    title: "Writing partner",
    category: "Recommended",
    kind: "colleague",
    summary: "Drafts in your voice, edits without flattening it.",
    suggestedTools: ["create_note", "get_note", "search_documents", "research"],
    mode: "chat",
  },
  {
    slug: "project-planner",
    title: "Project planner",
    category: "Recommended",
    kind: "colleague",
    summary: "Turns a vague ask into a sequence somebody can actually run.",
    suggestedTools: ["create_task", "list_tasks", "get_task", "update_task", "search_documents"],
    mode: "plan",
  },
  {
    slug: "technical-writer",
    title: "Technical writer",
    category: "Documentation",
    kind: "colleague",
    summary: "Documents what the code does, not what it was meant to do.",
    suggestedTools: ["create_note", "get_note", "search_documents", "extract_content"],
    mode: "chat",
  },
  {
    slug: "note-keeper",
    title: "Note keeper",
    category: "Documentation",
    kind: "colleague",
    summary: "Files the useful part of a conversation before it is lost.",
    suggestedTools: ["create_note", "get_note", "search_documents", "store_memory"],
    mode: "chat",
  },
  {
    slug: "code-reviewer",
    title: "Code reviewer",
    category: "Engineering",
    kind: "colleague",
    summary: "Reads the diff properly and says what will actually break.",
    suggestedTools: ["search_documents", "research", "run_sandbox_task", "get_task_status"],
    mode: "plan",
  },
  {
    slug: "build-engineer",
    title: "Build engineer",
    category: "Engineering",
    kind: "colleague",
    summary: "Takes a change through to something that runs and proves it.",
    suggestedTools: ["run_sandbox_task", "get_task_status", "search_documents", "web_search"],
    mode: "build",
  },
  {
    slug: "developer",
    title: "Developer",
    category: "Engineering",
    kind: "colleague",
    summary: "Builds the small internal thing, runs it, and shows you it working.",
    suggestedTools: [
      "run_sandbox_task",
      "get_task_status",
      "v0_code_generation",
      "write_document",
      "search_documents",
    ],
    mode: "build",
  },
  {
    slug: "market-watcher",
    title: "Market watcher",
    category: "Research",
    kind: "colleague",
    summary: "Tracks what competitors shipped, said and hired for.",
    suggestedTools: ["web_search", "research", "extract_content", "create_note"],
    mode: "explore",
  },
  {
    slug: "paper-reader",
    title: "Paper reader",
    category: "Research",
    kind: "colleague",
    summary: "Reads the long thing and tells you whether it is worth your time.",
    suggestedTools: ["extract_content", "extract_text_from_document", "research", "create_note"],
    mode: "explore",
  },
  {
    slug: "studio-artist",
    title: "Studio artist",
    category: "Creative",
    kind: "colleague",
    summary: "Makes images and video from a brief, and iterates on notes.",
    suggestedTools: ["create_image", "create_video", "capture_screenshot"],
    mode: "chat",
  },
  {
    slug: "sound-designer",
    title: "Sound designer",
    category: "Creative",
    kind: "colleague",
    summary: "Music and voice, cut to length and to brief.",
    suggestedTools: ["create_music", "create_speech"],
    mode: "chat",
  },
  {
    slug: "daily-briefer",
    title: "Daily briefer",
    category: "Bots",
    kind: "bot",
    summary: "One short brief, on a schedule, with nothing padded out.",
    suggestedTools: ["web_search", "research", "create_note"],
    mode: "chat",
  },
  {
    slug: "link-reader",
    title: "Link reader",
    category: "Bots",
    kind: "bot",
    summary: "Give it a link or a document and it gives you the substance.",
    suggestedTools: ["extract_content", "extract_text_from_document", "capture_screenshot"],
    mode: "chat",
  },
];

export function findTeammateRole(slug: string | null | undefined): TeammateRole | undefined {
  return TEAMMATE_ROLES.find((role) => role.slug === slug);
}

export function listTeammateRolesByCategory(): Array<{
  category: TeammateRoleCategory;
  roles: TeammateRole[];
}> {
  return TEAMMATE_ROLE_CATEGORIES.map((category) => ({
    category,
    roles: TEAMMATE_ROLES.filter((role) => role.category === category),
  })).filter((group) => group.roles.length > 0);
}

export const hireTeammateSchema = z
  .object({
    role_slug: z
      .string()
      .min(1)
      .optional()
      .meta({ description: "Slug of a built-in teammate role to hire" }),
    job_description: z.string().min(1).max(2000).optional().meta({
      description: "Plain description of the job, used when no built-in role is chosen",
    }),
    name: z.string().min(1).max(120).optional().meta({
      description: "Name for the teammate; defaults to the role title",
    }),
    kind: teammateKindSchema.optional().meta({
      description: "Whether this teammate is a colleague or a bot; defaults to the role's kind",
    }),
    workspace_id: z.string().min(1).optional().meta({
      description: "Workspace that will own the teammate; omit to hire into your personal scope",
    }),
  })
  .refine((value) => Boolean(value.role_slug || value.job_description), {
    error: "Choose a role or describe the job",
  });

export type HireTeammateInput = z.input<typeof hireTeammateSchema>;
