import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { fileKnowledgeSource } from "~/modules/knowledge/application/intake/file";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { ApiToolDefinition } from "~/types/functions";

import { create_note as create_noteDescriptor } from "./definitions/create_note";

export const create_note: ApiToolDefinition = {
  ...create_noteDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const context = resolveServiceContext(request);
    const source = await fileKnowledgeSource(context, {
      origin: "note",
      kind: "text",
      title: sanitiseInput(String(args.title ?? "")).slice(0, 200) || "Note",
      provider: null,
      content: sanitiseInput(String(args.content ?? "")),
      projectId: resolveRequestProjectId(request) ?? null,
      metadata: isRecord(args.metadata) ? args.metadata : {},
    });

    return {
      status: "success",
      name: "create_note",
      content: `Saved "${source.title}" as a note in Files`,
      data: { renderer: "saved_note", ...source },
    };
  },
};
