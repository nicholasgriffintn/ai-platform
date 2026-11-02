import { Button, FormInput, FormSelect, Switch } from "@ngriffin_uk/polychat-component-ui";
import { useWebPushRegistration } from "@ngriffin_uk/polychat-library-react";
import type { DiscoverDayProfile } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

export function DiscoverNotificationField({
  value,
  onChange,
}: {
  value: DiscoverDayProfile["notifications"];
  onChange: (value: DiscoverDayProfile["notifications"]) => void;
}) {
  const push = useWebPushRegistration();
  const categories: ReadonlyArray<{
    key: "commute" | "weather" | "news" | "briefings";
    label: string;
    description: string;
  }> = [
    {
      key: "commute",
      label: "Commute changes",
      description: "Disruption or a material delay before you travel.",
    },
    {
      key: "weather",
      label: "Weather changes",
      description: "Conditions that may change your plans.",
    },
    {
      key: "news",
      label: "Important topic updates",
      description: "Significant developments in topics you explicitly follow.",
    },
    {
      key: "briefings",
      label: "Podcast releases",
      description: "When a scheduled recording is ready.",
    },
  ];

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Notifications</legend>
      <Switch
        label="Allow Discover notifications"
        description="Discover keeps updating when notifications are off."
        checked={value.enabled}
        onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
      />
      {value.enabled ? (
        <>
          {categories.map((category) => (
            <Switch
              key={category.key}
              label={category.label}
              description={category.description}
              checked={value[category.key]}
              onChange={(event) => onChange({ ...value, [category.key]: event.target.checked })}
            />
          ))}
          <FormSelect
            label="Daily Discover limit"
            options={[
              { value: "0", label: "None" },
              { value: "1", label: "One notification" },
              { value: "2", label: "Up to two notifications" },
            ]}
            value={String(value.dailyLimit)}
            onValueChange={(dailyLimit) => onChange({ ...value, dailyLimit: Number(dailyLimit) })}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormInput
              label="Quiet from"
              type="time"
              value={value.quietStart}
              onChange={(event) => onChange({ ...value, quietStart: event.target.value })}
            />
            <FormInput
              label="Until"
              type="time"
              value={value.quietEnd}
              onChange={(event) => onChange({ ...value, quietEnd: event.target.value })}
            />
          </div>
          <Switch
            label="Keep working hours quiet"
            checked={value.quietWhileWorking}
            onChange={(event) => onChange({ ...value, quietWhileWorking: event.target.checked })}
          />
          <div className="rounded-lg border border-border p-3 text-sm">
            <p>
              {push.registered
                ? "This browser is ready to receive notifications."
                : push.available
                  ? "Allow this browser to receive notifications."
                  : "Browser notifications are unavailable here."}
            </p>
            {!push.registered && push.available ? (
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                isLoading={push.isRegistering}
                onClick={() => void push.register().catch(() => undefined)}
              >
                Allow browser notifications
              </Button>
            ) : null}
          </div>
          {push.error ? (
            <p role="alert" className="text-xs text-failure">
              {getErrorMessage(push.error, "This browser could not register for notifications")}
            </p>
          ) : null}
        </>
      ) : null}
    </fieldset>
  );
}
