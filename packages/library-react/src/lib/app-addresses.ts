import type { ProjectExperienceDefinition } from "@ngriffin_uk/polychat-schemas";

export interface ResolvedAppAddress<App extends ProjectExperienceDefinition> {
  app: App;
  subpath: string;
  isLegacy: boolean;
}

const splitPath = (path: string): string[] => path.split("/").filter(Boolean);

export function resolveAppAddress<App extends ProjectExperienceDefinition>(
  apps: readonly App[],
  path: string,
): ResolvedAppAddress<App> | undefined {
  const segments = splitPath(path);
  const bySlug = apps
    .map((app) => ({ app, slug: splitPath(app.slug) }))
    .filter(({ slug }) => slug.length > 0 && slug.every((part, index) => segments[index] === part))
    .sort((left, right) => right.slug.length - left.slug.length)[0];

  if (bySlug) {
    return {
      app: bySlug.app,
      subpath: segments.slice(bySlug.slug.length).join("/"),
      isLegacy: false,
    };
  }

  const byId = apps.find((app) => app.id === segments[0]);

  return byId ? { app: byId, subpath: segments.slice(1).join("/"), isLegacy: true } : undefined;
}

export function getExperienceCapabilityId(experience: ProjectExperienceDefinition): string {
  return experience.requirement.kind === "capability"
    ? experience.requirement.capabilityId
    : experience.id;
}

export function getAppProvenance(experience: ProjectExperienceDefinition): string | undefined {
  return experience.entry.kind === "remote" ? `from ${experience.entry.server}` : undefined;
}
