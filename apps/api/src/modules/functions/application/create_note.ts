import { createSourceSchema } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { enqueueSourceIndex } from "~/modules/sources/application/knowledge-indexing";
import { createSource } from "~/modules/sources/application/sources";
import type { ApiToolDefinition } from "~/types/functions";

import { create_note as create_noteDescriptor } from "./definitions/create_note";
import { resolveRequestProjectId } from "./request-context";

export const create_note: ApiToolDefinition = {
  ...create_noteDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const context = resolveServiceContext(request);
    const input = createSourceSchema.parse({
      kind: "text",
      title: sanitiseInput(args.title),
      content: sanitiseInput(args.content),
      projectId: resolveRequestProjectId(request),
      metadata: isRecord(args.metadata) ? args.metadata : {},
    });
    const source = await createSource(context, context.requireUser().id, input);

    await enqueueSourceIndex(context, source.id);

    return {
      status: "success",
      name: "create_note",
      content: "Note saved to the current knowledge sources",
      data: source,
    };
  },
};
