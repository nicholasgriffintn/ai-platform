import { conversationHandleParamsSchema, listPageOf } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ResourceBuilder } from "~/infrastructure/http/resource";

export function defineConversationHandles(conversations: ResourceBuilder): void {
  conversations
    .collection("handles", "handle_id")
    .list({
      auth: true,
      summary: "List conversation handles",
      description: "Active agent handles granted to delegations in the caller's conversations.",
      handler: async ({ serviceContext, user }) =>
        listPageOf(
          await serviceContext.repositories.conversationHandles.listForUser(user.id),
          (handle) => handle.id,
        ),
    })
    .delete({
      auth: true,
      summary: "Revoke a conversation handle",
      description:
        "Stops an agent from using a handle granted to one of the caller's conversations.",
      paramSchema: conversationHandleParamsSchema,
      handler: async ({ serviceContext, params, user }) => {
        const revoked = await serviceContext.repositories.conversationHandles.revokeForUser(
          params.handle_id,
          user.id,
          new Date().toISOString(),
        );

        if (!revoked) {
          throw new AssistantError("Conversation handle not found", ErrorType.NOT_FOUND, 404);
        }

        return { deleted: true };
      },
    });
}
