import type { RecipeExecutionTaskData } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  getMessagingProviderFromStoredCredential,
  selectConfiguredMessagingDelivery,
} from "~/lib/providers/capabilities/messaging/delivery";
import { deliverOutboundOperation } from "~/services/delivery/outbound";
import type { IEnv, IUser } from "~/types";

export async function deliverRecipeSmsNotification(params: {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  userId: number;
  taskId: string;
  taskData: RecipeExecutionTaskData;
  notification: { body: string; mediaUrls: string[] };
}): Promise<boolean> {
  const destination = params.taskData.notificationTarget?.trim();

  if (params.taskData.notificationChannel !== "sms" || !destination) {
    return false;
  }

  const messagingProvider = selectConfiguredMessagingDelivery(
    await params.context.repositories.userSettings.getUserProviderSettings(params.userId),
    { mediaUrls: params.notification.mediaUrls, apiBaseUrl: params.env.API_BASE_URL },
  );

  if (!messagingProvider) {
    throw new Error("No configured SMS provider can send this scheduled recipe notification");
  }

  const encryptedValue =
    await params.context.repositories.userSettings.getProviderApiKeyForSettings({
      userId: params.userId,
      providerId: messagingProvider.providerId,
      providerSettingsId: messagingProvider.id,
    });

  if (!encryptedValue) {
    throw new Error("SMS provider credentials are not configured");
  }

  const provider = getMessagingProviderFromStoredCredential({
    providerId: messagingProvider.providerId,
    value: encryptedValue,
    env: params.env,
    user: params.user,
    context: params.context,
  });

  await deliverOutboundOperation({
    context: params.context,
    deliveryId: `routine_sms_${params.taskId}`,
    userId: params.userId,
    kind: "routine_sms",
    scopeId: params.taskData.installationId ?? params.taskData.recipeId,
    operationId: params.taskData.occurrenceId ?? params.taskId,
    payload: {
      destination,
      body: params.notification.body,
      mediaUrls: params.notification.mediaUrls,
    },
    send: () =>
      provider.send({
        to: destination,
        body: params.notification.body,
        ...(messagingProvider.mediaUrls?.length ? { mediaUrls: messagingProvider.mediaUrls } : {}),
      }),
  });

  return true;
}
