import { sourceIndexTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { indexSource } from "~/modules/sources/application/knowledge-indexing";

import { defineTask } from "../workflows";

export const sourceIndex = defineTask({
  payload: sourceIndexTaskDataSchema,
  handle: async ({ sourceId, revision }, { env, message, execution }) => {
    if (!message.user_id) {
      return { status: "error", message: "Indexing user is required" };
    }

    const base = createServiceContext({ env });
    const user = await base.repositories.users.getUserById(message.user_id);

    if (!user) {
      return { status: "skipped", message: "Indexing user no longer exists" };
    }

    await indexSource(createServiceContext({ env, user }), sourceId, revision, () =>
      execution.lease.assertOwned(),
    );

    return { status: "success", message: "Source indexed" };
  },
});
