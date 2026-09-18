import type { ProviderUser } from "./env.js";

export interface RequestUserSource<TUser extends ProviderUser = ProviderUser> {
  context?: { user?: TUser };
}

export function resolveRequestUser<TUser extends ProviderUser>(
  source: RequestUserSource<TUser>,
): TUser | undefined {
  const contextUser = source.context?.user;

  if (contextUser?.id) {
    return contextUser;
  }

  return undefined;
}
