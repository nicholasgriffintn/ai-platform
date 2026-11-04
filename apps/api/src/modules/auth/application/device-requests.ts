import type { AuthChallengeRecord } from "@ngriffin_uk/auth-core";
import { DEVICE_USER_CODE_ALPHABET, DEVICE_USER_CODE_LENGTH } from "@ngriffin_uk/polychat-schemas";
import { randomFromAlphabet, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";

export const DEVICE_CHALLENGE_PROVIDER = "device";

const USER_CODE_ATTEMPTS = 3;

export function requestKey(userCode: string): Promise<string> {
  return sha256Hex(`device-request:${userCode}`);
}

export function requireAppBaseUrl(context: ServiceContext): string {
  const baseUrl = context.env.APP_BASE_URL;

  if (!baseUrl) {
    throw new AssistantError(
      "Device sign-in is unavailable because the app address is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

export async function createDeviceRequest(
  context: ServiceContext,
  record: Omit<AuthChallengeRecord, "tokenHash" | "provider" | "kind" | "attempts">,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const userCode = randomFromAlphabet(DEVICE_USER_CODE_LENGTH, DEVICE_USER_CODE_ALPHABET);

    try {
      await context.repositories.get(AuthChallengeRepository).create({
        ...record,
        tokenHash: await requestKey(userCode),
        provider: DEVICE_CHALLENGE_PROVIDER,
        kind: "custom",
        attempts: 0,
      });

      return userCode;
    } catch (error) {
      if (attempt >= USER_CODE_ATTEMPTS) {
        throw error;
      }
    }
  }
}
