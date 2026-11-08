import { secretRedactionVariants } from "@ngriffin_uk/polychat-library-sandbox";
import { secretHeaderAuthSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ApiToolExecutionContext } from "~/types/functions";

import { redeemSecretReference, resolveConversationSecretBinding } from "./secret-references";

export interface AppliedSecretHeader {
  secrets: string[];
  release: () => Promise<void>;
}

export async function applySecretHeader(params: {
  context: ApiToolExecutionContext;
  auth: unknown;
  url: URL;
  headers: Record<string, string>;
}): Promise<AppliedSecretHeader> {
  if (params.auth === undefined || params.auth === null) {
    return { secrets: [], release: async () => undefined };
  }

  const auth = secretHeaderAuthSchema.safeParse(params.auth);

  if (!auth.success) {
    throw new AssistantError(
      "auth needs a secret_ref from request_secret, an optional header name and a scheme of bearer or raw",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const userId = params.context.request.user?.id;
  const conversationId = params.context.completionId;
  const serviceContext = params.context.request.context;

  if (!userId || !conversationId || !serviceContext) {
    throw new AssistantError(
      "Secret references only work for a signed-in user in a saved conversation",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const headerName = auth.data.header.toLowerCase();

  if (Object.keys(params.headers).some((name) => name.toLowerCase() === headerName)) {
    throw new AssistantError(
      `Remove the ${auth.data.header} header; auth sets it from the secret reference`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const redeemed = await redeemSecretReference(serviceContext, {
    ...(await resolveConversationSecretBinding(serviceContext, userId, conversationId)),
    reference: auth.data.secret_ref,
    destination: params.url.toString(),
  });

  params.headers[auth.data.header] =
    auth.data.scheme === "bearer" ? `Bearer ${redeemed.value}` : redeemed.value;

  return { secrets: secretRedactionVariants(redeemed.value), release: redeemed.release };
}
