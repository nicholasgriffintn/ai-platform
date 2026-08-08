import type { ServiceContext } from "~/lib/context/serviceContext";
import { buildMobileRedirectUri, requireMobileRedirectUri } from "~/services/auth/mobile";
import { createAssistantMagicLinkAuth } from "~/services/auth/sharedAuth";
import { sendMagicLinkEmail } from "~/services/notifications";

export async function requestAssistantMagicLink({
	context,
	email,
	redirectUri,
}: {
	readonly context: ServiceContext;
	readonly email: string;
	readonly redirectUri?: string;
}): Promise<void> {
	const mobileRedirectUri = redirectUri
		? requireMobileRedirectUri(redirectUri, "/magic-link")
		: undefined;
	const magicLink = createAssistantMagicLinkAuth(context, async (delivery) => {
		if (!context.env.APP_BASE_URL) return;
		const link = mobileRedirectUri
			? buildMobileRedirectUri(mobileRedirectUri, {
					token: delivery.token,
					nonce: delivery.token,
				})
			: `${context.env.APP_BASE_URL}/auth/verify-magic-link?token=${encodeURIComponent(delivery.token)}&nonce=${encodeURIComponent(delivery.token)}`;
		await sendMagicLinkEmail(context.env, delivery.email, link);
	});
	await magicLink.providers["magic-link"].request(email);
}
