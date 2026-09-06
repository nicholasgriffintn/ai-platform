import { readFileSync } from "node:fs";
import { join } from "node:path";

export const RELEASE_APPS = [
  {
    id: "web",
    name: "@assistant/app",
    directory: "apps/app",
    title: "Polychat Web",
  },
  {
    id: "ios",
    name: "@assistant/mobile",
    directory: "apps/mobile",
    title: "Polychat iOS",
  },
  {
    id: "desktop",
    name: "@assistant/desktop",
    directory: "apps/desktop",
    title: "Polychat Desktop",
  },
];

export function findReleaseApp(id) {
  const app = RELEASE_APPS.find((candidate) => candidate.id === id);

  if (!app) {
    throw new Error(`Unknown release app "${id}".`);
  }

  return app;
}

export function readAppVersion(repositoryRoot, app) {
  const manifest = JSON.parse(
    readFileSync(join(repositoryRoot, app.directory, "package.json"), "utf8"),
  );

  return manifest.version;
}

export function releaseTag(app, version) {
  return `${app.id}-v${version}`;
}
