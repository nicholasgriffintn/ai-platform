import { generateId } from "@ngriffin_uk/polychat-utility-core";

const INSTALLATION_KEY = "polychat-notification-installation";

export function getNotificationInstallationId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const current = window.localStorage.getItem(INSTALLATION_KEY);

  if (current) {
    return current;
  }

  const installationId = generateId();

  window.localStorage.setItem(INSTALLATION_KEY, installationId);

  return installationId;
}
