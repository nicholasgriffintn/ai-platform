import type { ExternalIdentity, IdentityStore } from "@ngriffin_uk/auth-core";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	type AssistantAuthUser,
	initialiseAssistantUser,
	toAssistantAuthUser,
} from "~/services/auth/authUser";
import { resolveGitHubUser } from "~/services/auth/github";
import { getStringRecordValue } from "~/utils/objects";

export function createAssistantIdentityStore(
	context: ServiceContext,
): IdentityStore<AssistantAuthUser> {
	return {
		async findUser(provider, providerSubject) {
			const user = await context.repositories.users.getUserByOauthAccount(
				provider,
				providerSubject,
			);
			return user ? toAssistantAuthUser(user) : null;
		},
		async resolve(identity) {
			if (identity.provider === "apple") {
				return resolveAppleUser(context, identity);
			}
			if (identity.provider === "github") {
				return resolveGitHubUser(context, identity);
			}
			throw new TypeError("Unsupported external identity provider.");
		},
	};
}

async function resolveAppleUser(
	context: ServiceContext,
	identity: ExternalIdentity,
): Promise<AssistantAuthUser> {
	const existing = await context.repositories.users.getUserByOauthAccount(
		"apple",
		identity.providerSubject,
	);
	const name = getStringRecordValue(identity.claims, "name");
	if (existing) {
		const updates: Record<string, string> = {};
		if (name) updates.name = name;
		if (identity.emailVerified && identity.email) updates.email = identity.email;
		if (Object.keys(updates).length > 0) {
			await context.repositories.users.updateUser(existing.id, updates);
		}
		const updated = await context.repositories.users.getUserById(existing.id);
		return toAssistantAuthUser(updated ?? existing);
	}

	if (!identity.emailVerified || !identity.email) {
		throw new TypeError("A verified Apple email address is required for first sign-in.");
	}
	const emailUser = await context.repositories.users.getUserByEmail(identity.email);
	if (emailUser) {
		await context.repositories.users.createOauthAccount(
			emailUser.id,
			"apple",
			identity.providerSubject,
		);
		if (name) await context.repositories.users.updateUser(emailUser.id, { name });
		const updated = await context.repositories.users.getUserById(emailUser.id);
		return toAssistantAuthUser(updated ?? emailUser);
	}

	const created = await context.repositories.users.createUser({
		email: identity.email,
		name,
	});
	if (!created) throw new TypeError("Apple user creation failed.");
	await context.repositories.users.createOauthAccount(
		created.id,
		"apple",
		identity.providerSubject,
	);
	await initialiseAssistantUser(context, created.id);
	return toAssistantAuthUser(created);
}
