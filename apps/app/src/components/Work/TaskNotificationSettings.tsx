import { Button, Card, Switch } from "@ngriffin_uk/polychat-component-ui";
import type { TaskNotificationCategory } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { useTaskNotifications } from "~/hooks/useTaskNotifications";
import { getNotificationInstallationId } from "~/lib/notifications/installation";

const CATEGORY_LABELS: Record<TaskNotificationCategory, string> = {
  decisions: "Decisions and approvals",
  failures: "Meaningful failures",
  completions: "Useful completions",
  assignments: "New assignments",
};

export function TaskNotificationSettings() {
  const {
    settings,
    permission,
    registrationError,
    isLoading,
    isUpdating,
    enable,
    disable,
    setCategory,
  } = useTaskNotifications();
  const [installationId] = useState(getNotificationInstallationId);

  const currentRegistration = settings?.registrations.find(
    (registration) =>
      registration.platform === "web" && registration.installationId === installationId,
  );
  const isRegistered = currentRegistration?.state === "registered";
  const isEnabled = Boolean(settings?.preferences.enabled && isRegistered);

  const status = (() => {
    if (permission === null) {
      return "Checking browser notification permission…";
    }

    if (permission === "unsupported") {
      return "This browser does not support push notifications.";
    }

    if (permission === "denied") {
      return "Browser permission is blocked. Allow notifications in browser settings, then retry.";
    }

    if (registrationError) {
      return registrationError;
    }

    if (permission === "granted" && currentRegistration?.state === "failed") {
      return "Browser permission is allowed, but server registration failed. Retry to replace it.";
    }

    if (permission === "granted" && isRegistered) {
      return "Browser permission and server registration are active.";
    }

    return "Allow browser notifications to hear about task changes when Polychat is closed.";
  })();

  return (
    <Card className="mt-8 space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Task notifications</h2>
        <p className="mt-1 text-xs text-zinc-500">{status}</p>
      </div>

      <Switch
        id="task-notifications-enabled"
        label="Push notifications"
        checked={isEnabled}
        disabled={isLoading || isUpdating || permission === "unsupported"}
        onChange={(event) => void (event.target.checked ? enable() : disable())}
      />

      {settings && (
        <div className="grid gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:grid-cols-2">
          {(Object.keys(CATEGORY_LABELS) as TaskNotificationCategory[]).map((category) => (
            <Switch
              key={category}
              id={`task-notification-${category}`}
              label={CATEGORY_LABELS[category]}
              checked={settings.preferences[category]}
              disabled={!isEnabled || isUpdating}
              onChange={(event) => void setCategory(category, event.target.checked)}
            />
          ))}
        </div>
      )}

      {registrationError && permission !== "unsupported" && (
        <Button
          type="button"
          variant="secondary"
          disabled={isUpdating}
          onClick={() => void enable()}
        >
          Retry registration
        </Button>
      )}
    </Card>
  );
}
