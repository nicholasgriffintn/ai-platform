import { Button, Card, Switch } from "@ngriffin_uk/polychat-component-ui";
import { useTaskNotificationPreferences } from "@ngriffin_uk/polychat-library-react";
import type { TaskNotificationCategory } from "@ngriffin_uk/polychat-schemas";

import type { TaskNotificationChannel } from "../Notifications/task-notification-channel";

const CATEGORY_LABELS: Record<TaskNotificationCategory, string> = {
  decisions: "Decisions and approvals",
  failures: "Meaningful failures",
  completions: "Useful completions",
  assignments: "New assignments",
};

export function TaskNotificationSettings({ channel }: { channel: TaskNotificationChannel }) {
  const { settings, isLoading, isUpdating, setCategory } = useTaskNotificationPreferences();
  const isBusy = channel.isBusy || isUpdating;

  return (
    <Card className="mt-8 space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Task notifications</h2>
        <p className="mt-1 text-xs text-muted-foreground">{channel.status}</p>
      </div>

      <Switch
        id="task-notifications-enabled"
        label="Task notifications"
        checked={channel.isDeliverable}
        disabled={isLoading || isBusy || channel.isUnavailable}
        onChange={(event) => void (event.target.checked ? channel.enable() : channel.disable())}
      />

      {settings && (
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {(Object.keys(CATEGORY_LABELS) as TaskNotificationCategory[]).map((category) => (
            <Switch
              key={category}
              id={`task-notification-${category}`}
              label={CATEGORY_LABELS[category]}
              checked={settings.preferences[category]}
              disabled={!channel.isDeliverable || isBusy}
              onChange={(event) => void setCategory(category, event.target.checked)}
            />
          ))}
        </div>
      )}

      {channel.retry && (
        <Button
          type="button"
          variant="secondary"
          disabled={isBusy}
          onClick={() => void channel.retry?.()}
        >
          Retry registration
        </Button>
      )}
    </Card>
  );
}
