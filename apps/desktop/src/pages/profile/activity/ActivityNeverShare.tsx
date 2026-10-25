import { ProfileTabSection } from "@ngriffin_uk/polychat-component-shell";
import { Button, FormInput } from "@ngriffin_uk/polychat-component-ui";
import type { DeviceActivitySettings } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import type { DeviceActivityController } from "../../../hooks/useDeviceActivitySettings";
import {
  listNeverShared,
  withoutNeverShare,
} from "../../../infrastructure/device-activity-settings";

const KIND_LABELS = { domain: "Site", app: "App", project: "Project" } as const;

export function ActivityNeverShare({
  activity,
  settings,
}: {
  activity: DeviceActivityController;
  settings: DeviceActivitySettings;
}) {
  const [domain, setDomain] = useState("");
  const neverShared = listNeverShared(settings);

  return (
    <ProfileTabSection
      title="Never share"
      description="Sites, apps and projects on this list are skipped before anything is summarised. Add more from the lines below."
    >
      <div className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();

            if (domain.trim()) {
              activity.neverShare.mutate({ kind: "domain", value: domain.trim() });
              setDomain("");
            }
          }}
        >
          <div className="min-w-0 flex-1">
            <FormInput
              id="activity-never-share-domain"
              label="Add a site"
              placeholder="bank.example"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!domain.trim()}>
            Add
          </Button>
        </form>
        {neverShared.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing on the list yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {neverShared.map((key) => (
              <li
                key={`${key.kind}:${key.value}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{KIND_LABELS[key.kind]} · </span>
                  {key.value}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={activity.save.isPending}
                  onClick={() => activity.save.mutate(withoutNeverShare(settings, key))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProfileTabSection>
  );
}
