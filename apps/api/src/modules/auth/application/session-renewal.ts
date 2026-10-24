import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { AUTH_SESSION_RENEWAL_INTERVAL_MS, AUTH_SESSION_TTL_MS } from "~/config/app";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createAssistantAuth } from "~/modules/auth/application/sharedAuth";
import type { User } from "~/types";

const logger = getLogger({ prefix: "services/auth/session-renewal" });

export interface AuthenticatedSession {
  user: User;
  renewed: boolean;
}

export async function authenticateSession(
  context: ServiceContext,
  token: string,
  now: number = Date.now(),
): Promise<AuthenticatedSession | null> {
  const auth = createAssistantAuth(context);
  const session = await auth.authenticate(token);

  if (!session) {
    return null;
  }

  const user = session.user.record;
  const remainingMs = session.expiresAt.getTime() - now;

  if (remainingMs > AUTH_SESSION_TTL_MS - AUTH_SESSION_RENEWAL_INTERVAL_MS) {
    return { user, renewed: false };
  }

  try {
    return { user, renewed: (await auth.touchSession(token)) !== null };
  } catch (error) {
    logger.error("Session renewal failed:", { error });

    return { user, renewed: false };
  }
}
