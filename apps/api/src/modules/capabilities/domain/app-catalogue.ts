import {
  normaliseMcpServerLabel,
  type AppCategory,
  type AppEntry,
  type AppIconName,
  type AppIosDecision,
  type AppLayout,
  type AppScope,
  type AppSurfaceDefinition,
  type AppTheme,
  type ProjectExperienceDefinition,
  type ProjectExperienceRuntime,
  type RemoteApp,
} from "@ngriffin_uk/polychat-schemas";
import { claimUniqueSlug, hashSeed, slugify } from "@ngriffin_uk/polychat-utility-core";

/**
 * One entry per rich experience. Entries with a `capabilityId` are also published as apps a
 * project or person can enable; entries without one are always available alongside them.
 */
export interface ExperienceDefinition {
  id: string;
  entry: AppEntry;
  surface: AppSurfaceDefinition;
  name: string;
  description: string;
  when: string;
  uses: string;
  produces: string;
  ios: AppIosDecision;
  scope?: AppScope;
  scopeReason?: string;
  category: AppCategory;
  icon?: AppIconName;
  theme?: AppTheme;
  tags?: string[];
  type?: "normal" | "premium" | "byok";
  capabilityId?: string;
}

const CONTAINED: AppSurfaceDefinition = { layout: "contained", loading: "content" };
const WORKSPACE_STUDIO: AppSurfaceDefinition = { layout: "workspace", loading: "studio" };

const bundled = (runtime: ProjectExperienceRuntime): AppEntry => ({ kind: "bundled", runtime });

export const EXPERIENCES: ExperienceDefinition[] = [
  {
    id: "sites",
    entry: bundled("sites"),
    surface: WORKSPACE_STUDIO,
    capabilityId: "featured-sites",
    name: "Sites",
    category: "Creative",
    when: "You want a website, an app screen or a component from one description, and want to see it appear as it is written.",
    uses: "A single brief. Jev decides the kind, scope, tone and palette; a coding model writes the site.",
    produces:
      "A saved site you can refine in follow-ups, export as a runnable Next.js project, or hand to a project's sandbox for a full build.",
    ios: "web-only",
    description:
      "Describe a site once and watch it build. Refine it in follow-ups, export the code, or send it to the sandbox for a production build",
    icon: "layout",
    theme: "sky",
    tags: ["sites", "react", "generation", "code"],
    type: "premium",
  },
  {
    id: "benchmarks",
    entry: bundled("benchmarks"),
    surface: CONTAINED,
    capabilityId: "featured-benchmarks",
    name: "Benchmarks",
    category: "Models",
    when: "You want to see how your own models, or the ones on your keys, fare on Polychat's fun benchmarks, or fancy a round yourself.",
    uses: "Models you can already use, including your own keys, and your guesses when you play.",
    produces:
      "Private runs you can share by link, placed against the public board, plus your own scores against the models.",
    ios: "web-only",
    description:
      "Run GeoGuess, Countdown, Fermi Bets and friends against your own models, vote on hamsters, or play the board yourself",
    icon: "trophy",
    theme: "amber",
    tags: ["models", "game", "evaluation"],
    type: "premium",
  },
];

export const getExperienceCatalog = (): ExperienceDefinition[] => EXPERIENCES;

export const getProjectExperienceCatalog = (): ProjectExperienceDefinition[] =>
  EXPERIENCES.map(
    ({
      id,
      entry,
      surface,
      name,
      description,
      when,
      uses,
      produces,
      ios,
      scope,
      scopeReason,
      icon,
      category,
      theme,
      tags,
      type,
      capabilityId,
    }) => ({
      id,
      slug: id,
      entry,
      surface,
      name,
      description,
      when,
      uses,
      produces,
      ios,
      scope: scope ?? "any",
      scopeReason: scopeReason ?? null,
      icon,
      category,
      theme,
      tags,
      type,
      requirement: capabilityId
        ? { kind: "capability" as const, capabilityKind: "app" as const, capabilityId }
        : { kind: "capability_kind" as const, capabilityKind: "app" as const },
    }),
  );

export interface RemoteAppSource {
  server: string;
  tool: string;
  resourceUri: string;
  name: string;
  description?: string;
  category?: AppCategory;
  icon?: string;
  theme?: AppTheme;
  when?: string;
  uses?: string;
  produces?: string;
  layout: AppLayout;
}

const REMOTE_APP_SURFACES: Record<AppLayout, AppSurfaceDefinition> = {
  contained: CONTAINED,
  workspace: { layout: "workspace", loading: "editor" },
};

const REMOTE_APP_ID_PATTERN = /^mcp-[a-z0-9-]{1,80}-[0-9a-z]{1,7}$/;

const serverKey = (server: string): string => normaliseMcpServerLabel(server).toLowerCase();

export const remoteAppId = (server: string, tool: string): string => {
  const key = serverKey(server);

  return `mcp-${slugify(key, 32)}-${slugify(tool, 40)}-${hashSeed(`${key}\n${tool}`).toString(36)}`;
};

export const isRemoteAppId = (value: string): boolean => REMOTE_APP_ID_PATTERN.test(value);

const BUNDLED_APP_IDS = new Set(EXPERIENCES.map((experience) => experience.id));

export const isKnownAppId = (value: string): boolean =>
  BUNDLED_APP_IDS.has(value) || isRemoteAppId(value);

const compareSources = (left: RemoteAppSource, right: RemoteAppSource): number =>
  serverKey(left.server).localeCompare(serverKey(right.server)) ||
  left.tool.localeCompare(right.tool);

const assignServerSlugs = (sources: readonly RemoteAppSource[]): Map<string, string> => {
  const taken = new Set(BUNDLED_APP_IDS);
  const slugs = new Map<string, string>();

  for (const source of sources) {
    const key = serverKey(source.server);

    if (!slugs.has(key)) {
      slugs.set(key, claimUniqueSlug(slugify(key, 32) || "server", taken));
    }
  }

  return slugs;
};

export const getRemoteExperienceCatalog = (
  sources: readonly RemoteAppSource[],
): Omit<RemoteApp, "enabled">[] => {
  const ordered = [...sources].sort(compareSources);
  const serverSlugs = assignServerSlugs(ordered);
  const takenAppSlugs = new Map<string, Set<string>>();
  const seen = new Set<string>();

  return ordered.flatMap((source) => {
    const id = remoteAppId(source.server, source.tool);

    if (seen.has(id)) {
      return [];
    }

    seen.add(id);

    const serverSlug = serverSlugs.get(serverKey(source.server)) ?? "server";
    const taken = takenAppSlugs.get(serverSlug) ?? new Set<string>();
    const appSlug = claimUniqueSlug(
      slugify(source.name, 40) || slugify(source.tool, 40) || "app",
      taken,
    );

    takenAppSlugs.set(serverSlug, taken);

    return [
      {
        id,
        slug: `${serverSlug}/${appSlug}`,
        entry: {
          kind: "remote" as const,
          server: source.server,
          tool: source.tool,
          resource: source.resourceUri,
        },
        surface: REMOTE_APP_SURFACES[source.layout],
        name: source.name,
        description: source.description ?? `An app from ${source.server}.`,
        when: source.when ?? `You want ${source.name} from ${source.server} on its own page.`,
        uses:
          source.uses ??
          `Your connection to ${source.server}. It can only read through that connection.`,
        produces:
          source.produces ??
          "Whatever the app shows you. Anything that changes something is asked in a chat.",
        ios: "web-only" as const,
        scope: "personal" as const,
        scopeReason: "Apps from your MCP servers use your own connection.",
        icon: source.icon ?? "app",
        theme: source.theme ?? "slate",
        category: source.category ?? "Tools",
        tags: ["mcp"],
        type: "premium" as const,
        requirement: { kind: "capability_kind" as const, capabilityKind: "app" as const },
      },
    ];
  });
};
