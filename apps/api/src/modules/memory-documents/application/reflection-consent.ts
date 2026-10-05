import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveMemoryPolicy } from "~/modules/chat/domain/memory";

export async function requireMemoryReflectionConsent(context: ServiceContext) {
  const actor = context.requireUser();
  const [user, userSettings] = await Promise.all([
    context.repositories.users.getUserById(actor.id),
    context.repositories.userSettings.getUserSettings(actor.id),
  ]);

  if (!resolveMemoryPolicy({ user, userSettings, store: true }).canStore) {
    throw new AssistantError("Memory saving consent is unavailable", ErrorType.FORBIDDEN, 403);
  }
}
