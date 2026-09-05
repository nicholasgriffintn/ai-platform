import type {
  InternalServiceScope,
  InternalServiceTokenClaims,
} from "@ngriffin_uk/polychat-schemas";
import type { Context } from "hono";

import type { AnonymousUser, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export function requireAuthenticatedUser(ctx: Context): IUser {
  const user = ctx.get("user") as IUser | undefined;

  if (!user?.id) {
    throw new AssistantError(
      "This endpoint requires authentication. Please provide a valid access token.",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  return user;
}

export function requireAuthenticatedUserOrAnonymous(ctx: Context): {
  user: IUser | undefined;
  anonymousUser: AnonymousUser | undefined;
} {
  const user = ctx.get("user") as IUser | undefined;
  const anonymousUser = ctx.get("anonymousUser") as AnonymousUser | undefined;

  if (!user?.id && !anonymousUser?.id) {
    throw new AssistantError(
      "This endpoint requires authentication. Please provide a valid access token.",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  return { user, anonymousUser };
}

export function requireAuthenticatedService(
  ctx: Context,
  scope: InternalServiceScope,
): InternalServiceTokenClaims {
  const service = ctx.get("servicePrincipal") as InternalServiceTokenClaims | undefined;

  if (!service || !service.scopes.includes(scope)) {
    throw new AssistantError(
      "This endpoint requires an authorised internal service.",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return service;
}
