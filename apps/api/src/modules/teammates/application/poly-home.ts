import { isPolyTeammateId } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ResolvedTeammateInvocation } from "./execution";

export function requirePolyHomeRun(
  resolution: ResolvedTeammateInvocation | undefined,
  conversationId: string,
): void {
  const home = resolution?.context;

  if (
    !resolution ||
    (resolution.invocation.source !== "conversation" &&
      resolution.invocation.source !== "channel") ||
    !home ||
    !isPolyTeammateId(home.teammateId) ||
    home.scope.type !== "personal" ||
    home.status !== "active" ||
    home.homeConversationId !== conversationId
  ) {
    throw new AssistantError("Poly only works in its own conversation", ErrorType.FORBIDDEN, 403);
  }
}
