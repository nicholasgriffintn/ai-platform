import {
  CAPABILITY_DISCOVERY_TOOL_NAME,
  DEFERRED_TOOL_INDEX_MAX_ENTRIES,
} from "@ngriffin_uk/polychat-schemas";

import type { DeferredToolSession } from "~/lib/tools/DeferredToolSession";
import { escapeHtml } from "~/utils/html";

import { PromptBuilder } from "../builder";

export function buildDeferredToolsSection(session: DeferredToolSession | undefined): string {
  if (!session || session.size === 0) {
    return "";
  }

  const groups = session.groups();
  const builder = new PromptBuilder("<deferred_tools>")
    .addLine(
      "These tools belong to this conversation but their definitions are not loaded, so they cannot be called yet. Only their names are listed here.",
    )
    .addLine(
      `When a request needs one, call ${CAPABILITY_DISCOVERY_TOOL_NAME} with what you are trying to do. Every tool it returns with invocation.availableNow becomes callable on your next turn. Load before starting the work, and never call a name that has not been returned to you.`,
    );

  for (const group of groups) {
    builder
      .addLine("<group>")
      .addLine(`<name>${escapeHtml(group.name)}</name>`)
      .addLine(
        session.size > DEFERRED_TOOL_INDEX_MAX_ENTRIES
          ? `<count>${group.toolNames.length}</count>`
          : `<tools>${escapeHtml(group.toolNames.join(", "))}</tools>`,
      )
      .addLine("</group>");
  }

  return builder.addLine("</deferred_tools>").addLine().build();
}
