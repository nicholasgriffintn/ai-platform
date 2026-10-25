import { ProfileTabSection } from "@ngriffin_uk/polychat-component-shell";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { formatClockTime } from "@ngriffin_uk/polychat-utility-core";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

import type { DeviceActivityController } from "../../../hooks/useDeviceActivitySettings";

const SOURCE_TITLES = {
  browsing: "Browsing",
  agents: "Coding agents",
  apps: "Apps",
  music: "Music",
  games: "Games",
} as const;

export function ActivitySent({ activity }: { activity: DeviceActivityController }) {
  const [searchParams] = useSearchParams();
  const section = useRef<HTMLDivElement>(null);
  const latest = activity.sent.at(0);
  const wantsSent = searchParams.get("section") === "sent";

  useEffect(() => {
    if (wantsSent) {
      section.current?.scrollIntoView({ block: "start" });
    }
  }, [wantsSent]);

  return (
    <div ref={section} id="activity-sent">
      <ProfileTabSection
        title="What was sent"
        description={
          latest
            ? `Sent ${formatClockTime(latest.sentAt)} as ${latest.collection.label}. Each send replaces the last one, covering the past day.`
            : "Nothing has been sent yet. The first send happens a moment after you choose a source, then every 15 minutes."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={activity.sendNow.isPending}
              onClick={() => activity.sendNow.mutate()}
            >
              Send now
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              isLoading={activity.forget.isPending}
              disabled={!latest}
              onClick={() => activity.forget.mutate()}
            >
              Forget what was sent
            </Button>
          </div>
        }
      >
        {activity.sendNow.error ? (
          <p role="alert" className="text-sm text-failure">
            {activity.sendNow.error.message}
          </p>
        ) : null}
        {latest ? (
          <div className="space-y-5">
            {latest.collection.sources.map((source) => (
              <div key={source.source} className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  {SOURCE_TITLES[source.source]}
                </h3>
                {source.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing in the past day.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {source.items.map((item) => {
                      const { neverShare } = item;

                      return (
                        <li
                          key={item.line}
                          className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 break-words">{item.line}</span>
                          {neverShare ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              disabled={activity.neverShare.isPending}
                              onClick={() => activity.neverShare.mutate(neverShare)}
                            >
                              Never share this
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </ProfileTabSection>
    </div>
  );
}
