import type {
  DeviceActivityBrowser,
  DeviceActivityNeverShareKey,
  DeviceActivitySettings,
} from "@ngriffin_uk/polychat-schemas";

const PREFERRED_BROWSER = "helium";

const NEVER_SHARE_LISTS = {
  domain: "domains",
  app: "apps",
  project: "projects",
} as const;

export function withBrowsing(
  settings: DeviceActivitySettings,
  enabled: boolean,
  detected: readonly DeviceActivityBrowser[],
): DeviceActivitySettings {
  const preferred =
    detected.find((browser) => browser.id === PREFERRED_BROWSER) ?? detected.at(0) ?? null;
  const browsers =
    enabled && settings.browsing.browsers.length === 0 && preferred
      ? [{ browser: preferred.id, profiles: preferred.profiles.map((profile) => profile.id) }]
      : settings.browsing.browsers;

  return { ...settings, browsing: { ...settings.browsing, enabled, browsers } };
}

export function withBrowserProfile(
  settings: DeviceActivitySettings,
  browser: DeviceActivityBrowser,
  profileId: string,
  chosen: boolean,
): DeviceActivitySettings {
  const current =
    settings.browsing.browsers.find((selection) => selection.browser === browser.id)?.profiles ??
    [];
  const profiles = chosen
    ? [...new Set([...current, profileId])]
    : current.filter((profile) => profile !== profileId);
  const others = settings.browsing.browsers.filter((selection) => selection.browser !== browser.id);

  return {
    ...settings,
    browsing: {
      ...settings.browsing,
      browsers: profiles.length > 0 ? [...others, { browser: browser.id, profiles }] : others,
    },
  };
}

export function isBrowserProfileChosen(
  settings: DeviceActivitySettings,
  browserId: string,
  profileId: string,
): boolean {
  return settings.browsing.browsers.some(
    (selection) => selection.browser === browserId && selection.profiles.includes(profileId),
  );
}

export function withoutNeverShare(
  settings: DeviceActivitySettings,
  key: DeviceActivityNeverShareKey,
): DeviceActivitySettings {
  const list = NEVER_SHARE_LISTS[key.kind];

  return {
    ...settings,
    neverShare: {
      ...settings.neverShare,
      [list]: settings.neverShare[list].filter((value) => value !== key.value),
    },
  };
}

export function listNeverShared(settings: DeviceActivitySettings): DeviceActivityNeverShareKey[] {
  return [
    ...settings.neverShare.domains.map((value) => ({ kind: "domain" as const, value })),
    ...settings.neverShare.apps.map((value) => ({ kind: "app" as const, value })),
    ...settings.neverShare.projects.map((value) => ({ kind: "project" as const, value })),
  ];
}
