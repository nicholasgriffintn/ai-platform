import { memoryImportTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { enqueueKnowledgeProcessing } from "~/modules/knowledge/application/index/indexing";
import {
  advanceMemoryImport,
  importMemoryBatch,
} from "~/modules/memory-documents/application/import";
import { defineTask } from "~/modules/queue/application/workflows";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

export const memoryImport = defineTask({
  payload: memoryImportTaskDataSchema,
  handle: async (data, { env, message }) => {
    const user = message.user_id
      ? await new UserRepository(env).getUserById(message.user_id)
      : null;

    if (!user) {
      return { status: "skipped", message: "The import's owner is gone" };
    }

    const { remembered, documents } = await importMemoryBatch(
      createServiceContext({ env, user }),
      data,
    );

    for (const document of documents) {
      await enqueueKnowledgeProcessing(
        env,
        { id: document.id, project_id: null },
        user.id,
        "memory",
      );
    }

    await advanceMemoryImport(env, user.id, data);

    return {
      status: "success",
      message: `Part ${data.batch + 1} of ${data.offsets.length - 1}: remembered ${remembered}`,
      data: { remembered, documents: documents.map((document) => document.name) },
    };
  },
  onFinalFailure: async (data, _error, { env, message }) => {
    if (message.user_id) {
      await advanceMemoryImport(env, message.user_id, data);
    }
  },
});
