import { z } from "zod/v4";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { enqueueKnowledgeProcessing } from "~/modules/knowledge/application/index/indexing";
import { consolidateMemoryDocument } from "~/modules/memory-documents/application/remember";
import { defineTask } from "~/modules/queue/application/workflows";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

export const memoryConsolidation = defineTask({
  payload: z.object({ documentId: z.string().min(1) }),
  handle: async ({ documentId }, { env, message }) => {
    const user = message.user_id
      ? await new UserRepository(env).getUserById(message.user_id)
      : null;

    if (!user) {
      return { status: "skipped", message: "The memory's owner is gone" };
    }

    const document = await consolidateMemoryDocument(
      createServiceContext({ env, user }),
      documentId,
      user.id,
    );

    if (document) {
      await enqueueKnowledgeProcessing(
        env,
        {
          id: document.id,
          project_id: document.scope_type === "project" ? document.scope_id : null,
        },
        user.id,
        "memory",
      );
    }

    return { status: "success", message: "Recent memories folded into the document" };
  },
});
