import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Passkey } from "~/lib/database/schema";
import type { RepositoryManager } from "~/repositories";

const logger = getLogger({ prefix: "services/auth/webauthn" });

export async function getUserPasskeys(
  repositories: RepositoryManager,
  userId: number,
): Promise<Passkey[]> {
  try {
    return await repositories.webAuthn.getPasskeysByUserId(userId);
  } catch (error) {
    logger.error("Error getting user passkeys:", { error });

    return [];
  }
}

export async function deletePasskey(
  repositories: RepositoryManager,
  passkeyId: number,
  userId: number,
): Promise<boolean> {
  try {
    return await repositories.webAuthn.deletePasskey(passkeyId, userId);
  } catch (cause) {
    logger.error("Error deleting passkey:", { error: cause });
    throw new AssistantError("Failed to delete passkey", ErrorType.UNKNOWN_ERROR, 500, { cause });
  }
}
