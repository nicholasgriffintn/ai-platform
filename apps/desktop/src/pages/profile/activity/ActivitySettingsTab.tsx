import { ProfileTab, ProfileTabSection } from "@ngriffin_uk/polychat-component-shell";
import { Button, Switch } from "@ngriffin_uk/polychat-component-ui";

import { useDeviceActivitySettings } from "../../../hooks/useDeviceActivitySettings";
import { ActivityNeverShare } from "./ActivityNeverShare";
import { ActivitySent } from "./ActivitySent";
import { ActivitySources } from "./ActivitySources";
import { describeActivityStatus } from "./describe-status";

export function ActivitySettingsTab() {
  const activity = useDeviceActivitySettings();
  const { settings, status, save, pause, resume } = activity;

  return (
    <ProfileTab
      title="Activity on this Mac"
      description="Polychat reads what you browse, build, use and listen to on this Mac, turns it into short lines here, and sends only those lines to Discover and Poly. Nothing is read until you switch a source on."
    >
      {activity.loadError ? (
        <p role="alert" className="text-sm text-failure">
          {activity.loadError}
        </p>
      ) : null}
      {settings ? (
        <>
          <ProfileTabSection
            title="Share activity from this Mac"
            description={status ? describeActivityStatus(status) : undefined}
          >
            <div className="space-y-4">
              <Switch
                label="Share activity"
                description="Turning this off stops reading and removes what this Mac already sent."
                checked={settings.enabled}
                disabled={save.isPending}
                onChange={(event) => save.mutate({ ...settings, enabled: event.target.checked })}
              />
              {settings.enabled && status ? (
                <div className="flex flex-wrap gap-2">
                  {status.paused ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isLoading={resume.isPending}
                      onClick={() => resume.mutate()}
                    >
                      Resume sharing
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => pause.mutate("hour")}
                      >
                        Pause for an hour
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => pause.mutate("tomorrow")}
                      >
                        Pause until tomorrow
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => pause.mutate("untilResumed")}
                      >
                        Pause until I resume
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </ProfileTabSection>
          {settings.enabled ? (
            <>
              <ActivitySources activity={activity} settings={settings} />
              <ActivityNeverShare activity={activity} settings={settings} />
              <ActivitySent activity={activity} />
            </>
          ) : null}
        </>
      ) : null}
    </ProfileTab>
  );
}
