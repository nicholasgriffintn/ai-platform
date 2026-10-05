import { readMemoryDocumentSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveMemoryPolicy } from "~/modules/chat/domain/memory";
import { readRunMemoryDocument } from "~/modules/memory-documents/application/pages";
import type { ApiToolDefinition } from "~/types/functions";

import { read_memory_document as descriptor } from "./definitions/read_memory_document";

export const read_memory_document: ApiToolDefinition = {
  ...descriptor,
  execute: async (args, { request }) => {
    if (!request.context || !request.memoryScope) {
      throw new AssistantError(
        "Memory document reads require a scoped run",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    if (
      request.memoryScope.type !== "bound" &&
      !resolveMemoryPolicy({
        user: request.context.user,
        userSettings: await request.context.getUserSettings(),
        store: request.request?.store === true,
      }).canRetrieve
    ) {
      throw new AssistantError("Memory retrieval is disabled", ErrorType.FORBIDDEN, 403);
    }

    const page = await readRunMemoryDocument(
      request.context,
      request.memoryScope,
      readMemoryDocumentSchema.parse(args),
    );

    return { status: "success", name: descriptor.name, content: page.content, data: page };
  },
};
