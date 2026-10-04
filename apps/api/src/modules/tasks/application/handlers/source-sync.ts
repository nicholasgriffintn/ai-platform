import { sourceSyncTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { runSourceSyncPage } from "~/modules/sources/application/source-sync-worker";

import { defineTask } from "../workflows";

export const sourceSync = defineTask({
  payload: sourceSyncTaskDataSchema,
  handle: async (input, { env, message, execution }) => {
    if (!message.user_id) {
      return { status: "error", message: "Source sync owner is required" };
    }

    const base = createServiceContext({ env });
    const user = await base.repositories.users.getUserById(message.user_id);

    if (!user) {
      return { status: "skipped", message: "Source sync owner no longer exists" };
    }

    await runSourceSyncPage(createServiceContext({ env, user }), input, () =>
      execution.lease.assertOwned(),
    );

    return { status: "success", message: "Source sync page processed" };
  },
});
