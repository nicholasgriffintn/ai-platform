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
  "Personal",
  "Productivity",
  "Sales and marketing",
  "Operations",
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
  characterId?: string;
}

export const TEAMMATE_ROLES: readonly TeammateRole[] = [
  {
    slug: "inbox-tidy",
    title: "Inbox tidy",
    category: "Personal",
    kind: "bot",
    summary: "Clears the clutter and flags what is waiting on you.",
    suggestedTools: ["search_documents", "create_note", "create_automation", "request_approval"],
    mode: "chat",
    characterId: "moss",
  },
  {
    slug: "trip-watcher",
    title: "Trip watcher",
    category: "Personal",
    kind: "bot",
    summary: "Finds bookings in your mail and tells you when check-in opens.",
    suggestedTools: [
      "use_computer",
      "web_search",
      "create_note",
      "create_automation",
      "request_approval",
    ],
    mode: "chat",
    characterId: "kea",
  },
  {
    slug: "slot-watcher",
    title: "Slot watcher",
    category: "Personal",
    kind: "bot",
    summary: "Watches a booking page and asks before it books anything.",
    suggestedTools: ["use_computer", "create_note", "create_automation", "request_approval"],
    mode: "chat",
    characterId: "sprocket",
  },
  {
    slug: "dinner-planner",
    title: "Dinner planner",
    category: "Personal",
    kind: "colleague",
    summary: "Plans meals from what you have and fills a basket for approval.",
    suggestedTools: ["web_search", "research", "use_computer", "create_note", "request_approval"],
    mode: "chat",
    characterId: "ash",
  },
  {
    slug: "morning-brief",
    title: "Morning brief",
    category: "Productivity",
    kind: "bot",
    summary: "One short brief before you start, read aloud if you like.",
    suggestedTools: ["research", "create_note", "create_speech", "create_automation"],
    mode: "chat",
    characterId: "pip",
  },
  {
    slug: "meeting-prep",
    title: "Meeting prep",
    category: "Productivity",
    kind: "colleague",
    summary: "A brief before each meeting from calendar, mail and documents.",
    suggestedTools: ["research", "search_documents", "web_search", "create_note"],
    mode: "chat",
    characterId: "prism",
  },
  {
    slug: "focus-defender",
    title: "Focus defender",
    category: "Productivity",
    kind: "bot",
    summary: "Holds time for deep work and asks before moving anything.",
    suggestedTools: ["create_automation", "create_note", "request_approval"],
    mode: "chat",
    characterId: "wisp",
  },
  {
    slug: "podcast-digest",
    title: "Podcast digest",
    category: "Productivity",
    kind: "colleague",
    summary: "Summarises episodes so you know which ones deserve an hour.",
    suggestedTools: ["extract_content", "process_media", "research", "generate_podcast"],
    mode: "chat",
    characterId: "flask",
  },
  {
    slug: "outbound-in-your-voice",
    title: "Outbound in your voice",
    category: "Sales and marketing",
    kind: "colleague",
    summary: "Researches accounts and drafts outreach for you to review.",
    suggestedTools: ["research", "web_search", "write_document", "request_approval"],
    mode: "chat",
    characterId: "kea",
  },
  {
    slug: "signal-watch",
    title: "Signal watch",
    category: "Sales and marketing",
    kind: "bot",
    summary: "A weekday digest of competitor and prospect news.",
    suggestedTools: ["web_search", "research", "create_note", "create_automation"],
    mode: "explore",
    characterId: "bit",
  },
  {
    slug: "living-faq",
    title: "Living FAQ",
    category: "Sales and marketing",
    kind: "colleague",
    summary: "Keeps an FAQ current from the questions people actually ask.",
    suggestedTools: ["search_documents", "get_document", "write_document", "create_note"],
    mode: "chat",
    characterId: "moss",
  },
  {
    slug: "bug-reproduction",
    title: "Bug reproduction",
    category: "Engineering",
    kind: "colleague",
    summary: "Reproduces reported bugs and returns steps, evidence and a test.",
    suggestedTools: ["run_sandbox_task", "get_task_status", "use_computer", "create_note"],
    mode: "build",
    characterId: "bit",
  },
  {
    slug: "repo-orchestrator",
    title: "Repo orchestrator",
    category: "Engineering",
    kind: "colleague",
    summary: "Splits work across repositories and keeps one owner per stage.",
    suggestedTools: [
      "run_sandbox_task",
      "get_task_status",
      "create_task",
      "list_tasks",
      "delegate",
    ],
    mode: "plan",
    characterId: "sprocket",
  },
  {
    slug: "expense-manager",
    title: "Expense manager",
    category: "Operations",
    kind: "bot",
    summary: "Matches receipts and drafts one follow-up per owner.",
    suggestedTools: [
      "search_documents",
      "extract_text_from_document",
      "create_note",
      "request_approval",
    ],
    mode: "chat",
    characterId: "flask",
  },
  {
    slug: "new-hire-ramp",
    title: "New hire ramp",
    category: "Operations",
    kind: "colleague",
    summary: "Builds a ramp plan when someone joins.",
    suggestedTools: ["create_task", "list_tasks", "write_document", "search_documents"],
    mode: "plan",
    characterId: "pip",
  },
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
