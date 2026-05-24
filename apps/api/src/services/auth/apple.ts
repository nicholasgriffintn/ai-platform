import { verifyAppleIdentityToken } from "~/lib/auth/appleIdentityToken";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { createOrUpdateAppleUser, createSession } from "~/services/auth/user";
import type { IEnv, User } from "~/types";

export async function handleAppleIdentityTokenSignIn({
	context,
	env,
	identityToken,
	nonce,
	fullName,
}: {
	context?: ServiceContext;
	env?: IEnv;
	identityToken: string;
	nonce: string;
	fullName?: string;
}): Promise<{ user: User; sessionId: string }> {
	const serviceContext = resolveServiceContext({ context, env });
	const identity = await verifyAppleIdentityToken({
		env: serviceContext.env,
		identityToken,
		nonce,
	});

	const user = await createOrUpdateAppleUser(serviceContext.repositories, {
		appleId: identity.sub,
		email: identity.emailVerified ? identity.email : undefined,
		name: fullName,
	});

	const sessionId = await createSession(serviceContext.repositories, user.id);

	return { user, sessionId };
}
