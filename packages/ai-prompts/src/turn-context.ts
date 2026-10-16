import { escapeHtml } from "@ngriffin_uk/polychat-utility-core";

import type { GoalInput, GoalProgressEntryInput } from "./chat.js";
import { getPromptText, renderPrompt } from "./prompts.js";

const JOURNAL_TAIL_LENGTH = 5;

function formatJournalEntry(entry: GoalProgressEntryInput): string {
  const lines = [
    renderPrompt("chat/goal/journal/base", { surface: entry.surface, summary: entry.summary }),
  ];

  if (entry.steer) {
    lines.push(renderPrompt("chat/goal/journal/steer", { steer: entry.steer }));
  }

  if (entry.evidence.length > 0) {
    lines.push(renderPrompt("chat/goal/journal/evidence", { evidence: entry.evidence.join(", ") }));
  }

  if (entry.next) {
    lines.push(renderPrompt("chat/goal/journal/next", { next: entry.next }));
  }

  return lines.join("\n");
}

export function buildGoalProgressSection(goal: GoalInput): string {
  const journal = goal.progress.slice(-JOURNAL_TAIL_LENGTH);
  const lines: string[] = [];

  if (goal.stall_streak > 0) {
    lines.push(getPromptText("chat/goal/stall-warning"));
  }

  if (journal.length > 0) {
    lines.push(
      renderPrompt("chat/goal/progress-header", { iterationCount: goal.iteration_count }),
      ...journal.map(formatJournalEntry),
      "</progress_so_far>",
    );
  }

  return lines.length > 0 ? `<goal_progress>\n${lines.join("\n")}\n</goal_progress>\n` : "";
}

export const POLY_PLACE_LABELS: Readonly<Record<string, string>> = {
  conversations: "Conversations",
  canvas: "Canvas",
  sites: "Sites",
  attention: "Attention",
  files: "Files",
  teammates: "Teammates",
  scheduled: "Scheduled",
  plugins: "Plugins",
  you: "Account settings",
};

export const POLY_MODE_LABELS: Readonly<Record<string, string>> = {
  chat: "Chat",
  work: "Work",
};

export interface PolyUiContextInput {
  mode?: string | null;
  place?: string | null;
  route?: string | null;
  conversationId?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  runId?: string | null;
}

function buildUiContextSection(uiContext?: PolyUiContextInput | null): string {
  if (!uiContext) {
    return "";
  }

  const lines = [
    "<ui_context>",
    uiContext.mode ? `<mode>${POLY_MODE_LABELS[uiContext.mode] ?? uiContext.mode}</mode>` : null,
    uiContext.place
      ? `<place>${POLY_PLACE_LABELS[uiContext.place] ?? uiContext.place}</place>`
      : null,
    uiContext.route ? `<route>${escapeHtml(uiContext.route)}</route>` : null,
    uiContext.conversationId
      ? `<open_conversation_id>${escapeHtml(uiContext.conversationId)}</open_conversation_id>`
      : null,
    uiContext.workspaceId
      ? `<workspace_id>${escapeHtml(uiContext.workspaceId)}</workspace_id>`
      : null,
    uiContext.projectId ? `<project_id>${escapeHtml(uiContext.projectId)}</project_id>` : null,
    uiContext.taskId ? `<task_id>${escapeHtml(uiContext.taskId)}</task_id>` : null,
    uiContext.runId ? `<run_id>${escapeHtml(uiContext.runId)}</run_id>` : null,
    getPromptText("chat/poly/ui-context-note"),
    "</ui_context>",
  ].filter((line): line is string => Boolean(line));

  return `${lines.join("\n")}\n`;
}

export interface PolyAgendaPromptInput {
  needsYou: readonly string[];
  workingOn: readonly string[];
  done: readonly string[];
  noted: readonly string[];
}

function buildAgendaList(tag: string, items: readonly string[]): string | null {
  if (items.length === 0) {
    return null;
  }

  return [`<${tag}>`, ...items.map((item) => `- ${escapeHtml(item)}`), `</${tag}>`].join("\n");
}

function buildAgendaSection(agenda?: PolyAgendaPromptInput | null): string {
  if (!agenda) {
    return "";
  }

  const lists = [
    buildAgendaList("needs_you", agenda.needsYou),
    buildAgendaList("working_on", agenda.workingOn),
    buildAgendaList("done_this_week", agenda.done),
    buildAgendaList("noted_quietly", agenda.noted),
  ].filter((list): list is string => Boolean(list));

  if (lists.length === 0) {
    return "";
  }

  return `<agenda>\n${lists.join("\n")}\n${getPromptText("chat/poly/agenda-note")}\n</agenda>\n`;
}

export interface TurnSkillInput {
  id: string;
  body: string;
}

export interface TurnContextInput {
  uiContext?: PolyUiContextInput | null;
  agenda?: PolyAgendaPromptInput | null;
  goal?: GoalInput | null;
  skills?: readonly TurnSkillInput[];
}

function buildSelectedSkillsSection(skills: readonly TurnSkillInput[] = []): string {
  if (skills.length === 0) {
    return "";
  }

  return [
    "<selected_skills>",
    getPromptText("chat/turn-context/skills-note"),
    ...skills.map((skill) => `<skill name="${escapeHtml(skill.id)}">\n${skill.body}\n</skill>`),
    "</selected_skills>",
  ].join("\n");
}

export function buildTurnContext({ uiContext, agenda, goal, skills }: TurnContextInput): string {
  const sections = [
    buildSelectedSkillsSection(skills),
    buildUiContextSection(uiContext),
    buildAgendaSection(agenda),
    goal ? buildGoalProgressSection(goal) : "",
  ].filter(Boolean);

  if (sections.length === 0) {
    return "";
  }

  return [
    "<turn_context>",
    getPromptText("chat/turn-context/note"),
    ...sections.map((section) => section.trimEnd()),
    "</turn_context>",
  ].join("\n");
}
