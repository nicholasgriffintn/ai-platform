import {
  getNotificationInstallationId,
  registerTaskNotifications,
} from "@ngriffin_uk/polychat-library-client";

import { decodeWebPushPublicKey, notificationPermission } from "./web-push.js";

export async function currentPushSubscription() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;

  return registration.pushManager.getSubscription();
}

export async function registerWebPushSubscription(publicKey: string, requestPermission: boolean) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported in this browser");
  }

  let permission = notificationPermission();

  if (requestPermission && permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked in browser settings"
        : "Notification permission was not granted",
    );
  }

  const serviceWorker = await navigator.serviceWorker.ready;
  const subscription =
    (await serviceWorker.pushManager.getSubscription()) ??
    (await serviceWorker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeWebPushPublicKey(publicKey),
    }));
  const json = subscription.toJSON();

  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("The browser returned an incomplete push subscription");
  }

  return registerTaskNotifications({
    platform: "web",
    installationId: getNotificationInstallationId(),
    subscription: {
      endpoint: json.endpoint,
      expirationTime: subscription.expirationTime,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
  });
}
