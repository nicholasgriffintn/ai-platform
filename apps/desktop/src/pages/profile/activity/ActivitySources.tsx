import { ProfileTabSection } from "@ngriffin_uk/polychat-component-shell";
import { Button, Switch } from "@ngriffin_uk/polychat-component-ui";
import type { DeviceActivitySettings } from "@ngriffin_uk/polychat-schemas";

import type { DeviceActivityController } from "../../../hooks/useDeviceActivitySettings";
import {
  isBrowserProfileChosen,
  withBrowserProfile,
  withBrowsing,
} from "../../../infrastructure/device-activity-settings";

const APPLE_MUSIC = "com.apple.Music";
const SPOTIFY = "com.spotify.client";

export function ActivitySources({
  activity,
  settings,
}: {
  activity: DeviceActivityController;
  settings: DeviceActivitySettings;
}) {
  const { browsers, permissions, save, openPrivacyPane } = activity;
  const change = (next: DeviceActivitySettings) => save.mutate(next);
  const refused = new Set(permissions?.refused ?? []);
  const needsAccessibility =
    settings.apps.windowTitles &&
    (permissions?.accessibility === false || refused.has("windowTitles"));
  const needsAutomation =
    (settings.music.appleMusic && refused.has(APPLE_MUSIC)) ||
    (settings.music.spotify && refused.has(SPOTIFY));

  return (
    <ProfileTabSection
      title="Sources"
      description="Each source is read on this Mac. Only the summary lines below ever leave it."
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <Switch
            label="Browsing"
            description="Sites you visited, with time spent. Private windows are never recorded by your browser, so they never reach Polychat."
            checked={settings.browsing.enabled}
            disabled={save.isPending}
            onChange={(event) => change(withBrowsing(settings, event.target.checked, browsers))}
          />
          {settings.browsing.enabled ? (
            <div className="space-y-3 border-l border-border pl-4">
              {browsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No supported browsers found. Helium, Chrome, Brave, Arc, Edge, Vivaldi and
                  Chromium are supported.
                </p>
              ) : (
                browsers.flatMap((browser) =>
                  browser.profiles.map((profile) => (
                    <Switch
                      key={`${browser.id}:${profile.id}`}
                      label={
                        browser.profiles.length > 1
                          ? `${browser.name} · ${profile.name}`
                          : browser.name
                      }
                      checked={isBrowserProfileChosen(settings, browser.id, profile.id)}
                      disabled={save.isPending}
                      onChange={(event) =>
                        change(
                          withBrowserProfile(settings, browser, profile.id, event.target.checked),
                        )
                      }
                    />
                  )),
                )
              )}
              <Switch
                label="Include page titles"
                description="Off sends site names and time only."
                checked={settings.browsing.titles}
                disabled={save.isPending}
                onChange={(event) =>
                  change({
                    ...settings,
                    browsing: { ...settings.browsing, titles: event.target.checked },
                  })
                }
              />
              <Switch
                label="Include searches"
                description="The words you typed into a search engine."
                checked={settings.browsing.searches}
                disabled={save.isPending}
                onChange={(event) =>
                  change({
                    ...settings,
                    browsing: { ...settings.browsing, searches: event.target.checked },
                  })
                }
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <Switch
            label="Claude Code"
            description="Project, session title and prompt count."
            checked={settings.agents.claudeCode}
            disabled={save.isPending}
            onChange={(event) =>
              change({
                ...settings,
                agents: { ...settings.agents, claudeCode: event.target.checked },
              })
            }
          />
          <Switch
            label="Codex"
            description="Project, thread name and prompt count."
            checked={settings.agents.codex}
            disabled={save.isPending}
            onChange={(event) =>
              change({ ...settings, agents: { ...settings.agents, codex: event.target.checked } })
            }
          />
          {settings.agents.claudeCode || settings.agents.codex ? (
            <div className="border-l border-border pl-4">
              <Switch
                label="Include each session's first prompt"
                description="Prompts can carry pasted secrets, so this stays off unless you want it."
                checked={settings.agents.prompts}
                disabled={save.isPending}
                onChange={(event) =>
                  change({
                    ...settings,
                    agents: { ...settings.agents, prompts: event.target.checked },
                  })
                }
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <Switch
            label="Apps you use"
            description="Time in the front app, checked every 30 seconds while you're at the keyboard."
            checked={settings.apps.enabled}
            disabled={save.isPending}
            onChange={(event) =>
              change({ ...settings, apps: { ...settings.apps, enabled: event.target.checked } })
            }
          />
          {settings.apps.enabled ? (
            <div className="space-y-3 border-l border-border pl-4">
              <Switch
                label="Include window titles"
                description="Needs Accessibility permission for Polychat."
                checked={settings.apps.windowTitles}
                disabled={save.isPending}
                onChange={(event) =>
                  change({
                    ...settings,
                    apps: { ...settings.apps, windowTitles: event.target.checked },
                  })
                }
              />
              {needsAccessibility ? (
                <PermissionNote
                  text="macOS hasn't given Polychat Accessibility access, so window titles are left out."
                  action="Open Accessibility settings"
                  onOpen={() => void openPrivacyPane("accessibility")}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <Switch
            label="Apple Music"
            description="What's playing, read only while Music is open."
            checked={settings.music.appleMusic}
            disabled={save.isPending}
            onChange={(event) =>
              change({
                ...settings,
                music: { ...settings.music, appleMusic: event.target.checked },
              })
            }
          />
          <Switch
            label="Spotify"
            description="What's playing, read only while Spotify is open."
            checked={settings.music.spotify}
            disabled={save.isPending}
            onChange={(event) =>
              change({ ...settings, music: { ...settings.music, spotify: event.target.checked } })
            }
          />
          {needsAutomation ? (
            <PermissionNote
              text="macOS refused Polychat's request to ask your music app what's playing."
              action="Open Automation settings"
              onOpen={() => void openPrivacyPane("automation")}
            />
          ) : null}
        </div>
      </div>
    </ProfileTabSection>
  );
}

function PermissionNote({
  text,
  action,
  onOpen,
}: {
  text: string;
  action: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{text}</span>
      <Button type="button" variant="outline" size="sm" onClick={onOpen}>
        {action}
      </Button>
    </div>
  );
}
