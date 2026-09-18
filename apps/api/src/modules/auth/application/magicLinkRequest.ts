import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  buildNativeRedirectUri,
  requireAnyNativeRedirectUri,
} from "~/modules/auth/application/native";
import { createAssistantMagicLinkAuth } from "~/modules/auth/application/sharedAuth";
import { sendMagicLinkEmail } from "~/modules/notifications/application";

export async function requestAssistantMagicLink({
  context,
  email,
  redirectUri,
}: {
  readonly context: ServiceContext;
  readonly email: string;
  readonly redirectUri?: string;
}): Promise<void> {
  const nativeRedirectUri = redirectUri
    ? requireAnyNativeRedirectUri(redirectUri, "/magic-link")
    : undefined;
  const magicLink = createAssistantMagicLinkAuth(context, async (delivery) => {
    if (!context.env.APP_BASE_URL) {
      return;
    }

    const link = nativeRedirectUri
      ? buildNativeRedirectUri(nativeRedirectUri, {
          token: delivery.token,
        })
      : `${context.env.APP_BASE_URL}/auth/verify-magic-link?token=${encodeURIComponent(delivery.token)}`;

    await sendMagicLinkEmail(context.env, delivery.email, link);
  });

  await magicLink.providers["magic-link"].request(email);
}
