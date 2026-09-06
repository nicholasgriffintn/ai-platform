import type { MetaAssistantUiContext } from "@ngriffin_uk/polychat-schemas";
import { escapeHtml } from "@ngriffin_uk/polychat-utility-core";

import type { IUser, IUserSettings } from "~/types";

import { PromptBuilder } from "./builder";
import { buildSafetyStandardsSection } from "./sections/safety";

const PLACE_LABELS: Record<NonNullable<MetaAssistantUiContext["place"]>, string> = {
  conversations: "Conversations",
  attention: "Attention",
  files: "Files",
  teammates: "Teammates",
  you: "Account settings",
};

const MODE_LABELS: Record<NonNullable<MetaAssistantUiContext["mode"]>, string> = {
  chat: "Chat",
  work: "Work",
};

function buildUiContextSection(uiContext: MetaAssistantUiContext | undefined): string {
  if (!uiContext) {
    return "";
  }

  const lines = [
    "<ui_context>",
    uiContext.mode ? `<mode>${MODE_LABELS[uiContext.mode]}</mode>` : null,
    uiContext.place ? `<place>${PLACE_LABELS[uiContext.place]}</place>` : null,
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
    "<note>These ids describe what the user is looking at right now. Use them to resolve phrases such as 'this conversation' or 'the project I have open'. Every tool re-checks access; the ids grant nothing by themselves.</note>",
    "</ui_context>",
  ].filter((line): line is string => Boolean(line));

  return `${lines.join("\n")}\n`;
}

export function returnMetaAssistantPrompt({
  uiContext,
  user,
  userSettings,
}: {
  uiContext?: MetaAssistantUiContext;
  user?: IUser;
  userSettings?: IUserSettings;
}): string {
  const preferredName = userSettings?.nickname?.trim() || user?.name?.trim() || null;

  return new PromptBuilder(
    `<role>
You are Poly, the assistant that operates Polychat itself for ${preferredName ? escapeHtml(preferredName) : "the signed-in user"}. You are a home base for finding, opening, tidying and reading their conversations, projects and workspaces. You are not a teammate and you do not do the user's outside work.
</role>`,
  )
    .addLine()
    .add(
      `<behaviour>
- Act through your tools. Never describe how to click through the interface when a tool can take the user there.
- Resolve vague references with the ui_context before asking. Ask one short question only when the target is genuinely ambiguous.
- Prefer find_places before organise_conversation or open_place when you were not given an id.
- Confirm before archiving, renaming or snoozing anything the user did not name explicitly, and before acting on more than one conversation.
- Keep replies to a sentence or two. Report what you did in plain words, for example "Archived the roadmap thread" or "Opening #launch-week".
- You cannot approve tool requests, run connectors, browse the web, write code or act for other people. Say so briefly if asked, then offer the nearest thing you can do.
- Dry British wit is welcome in small doses. No exclamation marks.
</behaviour>`,
    )
    .addLine()
    .add(buildUiContextSection(uiContext))
    .add(buildSafetyStandardsSection())
    .build();
}
