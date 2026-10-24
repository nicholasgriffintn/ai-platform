import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

export async function loadUserContext(
  env: IEnv,
  userId: number | undefined,
): Promise<ServiceContext | null> {
  const user = userId ? await new UserRepository(env).getUserById(userId) : null;

  return user ? createServiceContext({ env, user }) : null;
}
