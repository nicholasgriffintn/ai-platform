import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Repositories } from "~/infrastructure/database/repositories";
import type { Passkey } from "~/infrastructure/database/user-credentials";
import { WebAuthnRepository } from "~/modules/auth/infrastructure/WebAuthnRepository";

const logger = getLogger({ prefix: "services/auth/webauthn" });

export async function getUserPasskeys(
  repositories: Repositories,
  userId: number,
): Promise<Passkey[]> {
  try {
    return await repositories.get(WebAuthnRepository).getPasskeysByUserId(userId);
  } catch (error) {
    logger.error("Error getting user passkeys:", { error });

    return [];
  }
}

export async function deletePasskey(
  repositories: Repositories,
  passkeyId: number,
  userId: number,
): Promise<boolean> {
  try {
    return await repositories.get(WebAuthnRepository).deletePasskey(passkeyId, userId);
  } catch (cause) {
    logger.error("Error deleting passkey:", { error: cause });
    throw new AssistantError("Failed to delete passkey", ErrorType.UNKNOWN_ERROR, 500, { cause });
  }
}
