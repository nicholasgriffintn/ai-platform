import {
  AGE_GATE_MINIMUM_AGE,
  type AgeCheckResult,
  type AgeGateStatus,
} from "@ngriffin_uk/polychat-schemas";
import { wholeYearsSince } from "@ngriffin_uk/polychat-utility-core";
import { readBooleanEnv } from "@ngriffin_uk/polychat-utility-server/env";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { Repositories } from "~/infrastructure/database/repositories";
import { AnonymousUserRepository } from "~/modules/user/infrastructure/AnonymousUserRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { AnonymousUser, IEnv, User } from "~/types";

const LATEST_TIME_ZONE_OFFSET_MS = 14 * 60 * 60 * 1000;
const OLDEST_PLAUSIBLE_AGE = 120;

export interface AgeGatePrincipal {
  user: User | null | undefined;
  anonymousUser: AnonymousUser | null | undefined;
}

export function isAgeGateEnabled(env: Pick<IEnv, "AGE_GATE_ENABLED">): boolean {
  return readBooleanEnv(env.AGE_GATE_ENABLED, true);
}

export function resolveAgeGateStatus(
  env: Pick<IEnv, "AGE_GATE_ENABLED">,
  principal: AgeGatePrincipal,
): AgeGateStatus {
  if (!isAgeGateEnabled(env)) {
    return "not_required";
  }

  return (principal.user ?? principal.anonymousUser)?.age_check ?? "pending";
}

export function ageCheckResultFor(birthDate: string, now = new Date()): AgeCheckResult {
  const age = wholeYearsSince(birthDate, new Date(now.getTime() + LATEST_TIME_ZONE_OFFSET_MS));

  if (age === null || age > OLDEST_PLAUSIBLE_AGE) {
    throw new AssistantError("Enter your real date of birth.", ErrorType.PARAMS_ERROR, 400);
  }

  return age >= AGE_GATE_MINIMUM_AGE ? "adult" : "under_age";
}

export async function recordAgeConfirmation({
  env,
  repositories,
  principal,
  birthDate,
}: {
  env: Pick<IEnv, "AGE_GATE_ENABLED">;
  repositories: Repositories;
  principal: AgeGatePrincipal;
  birthDate: string;
}): Promise<AgeGateStatus> {
  const currentStatus = resolveAgeGateStatus(env, principal);

  if (currentStatus !== "pending") {
    return currentStatus;
  }

  const result = ageCheckResultFor(birthDate);

  if (principal.user) {
    const user = await repositories.get(UserRepository).recordAgeCheck(principal.user.id, result);

    return user?.age_check ?? result;
  }

  if (principal.anonymousUser) {
    const anonymousUser = await repositories
      .get(AnonymousUserRepository)
      .recordAgeCheck(principal.anonymousUser.id, result);

    return anonymousUser?.age_check ?? result;
  }

  throw new AssistantError(
    "Start a session before confirming your date of birth.",
    ErrorType.AUTHENTICATION_ERROR,
    401,
  );
}
