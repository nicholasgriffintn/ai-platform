import type {
  AppEntry,
  AppIosDecision,
  AppScope,
  AppSurfaceDefinition,
  AppTheme,
  ProjectExperienceDefinition,
  ProjectExperienceRuntime,
} from "@ngriffin_uk/polychat-schemas";

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
  category: string;
  icon?: string;
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
    id: "strudel",
    entry: bundled("strudel"),
    surface: CONTAINED,
    capabilityId: "featured-strudel",
    name: "Strudel Music Patterns",
    category: "Creative",
    when: "You want a playable music pattern rather than a rendered audio file.",
    uses: "A description of the sound, or a pattern you already have.",
    produces: "A Strudel pattern you can play, edit and hand back into a conversation.",
    ios: "results-only",
    description:
      "Create and generate music patterns with AI using Strudel's powerful code-based music creation tool",
    icon: "music",
    theme: "indigo",
    tags: ["music", "audio", "generation"],
    type: "premium",
  },
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
    id: "verbatim",
    entry: bundled("verbatim"),
    surface: CONTAINED,
    capabilityId: "featured-verbatim",
    name: "Verbatim",
    category: "Decisions",
    when: "You want a live transcript you can trust word for word, not one that fills the gaps with guesses.",
    uses: "Your microphone. Each phrase is transcribed, then Clef Omni listens again and checks every word.",
    produces:
      "A live transcript with a probability on every word, fluency and verbatim checks, and words the audio never said struck out.",
    ios: "web-only",
    description:
      "Live transcription that listens twice: every word is checked against the audio and anything it cannot hear is struck out",
    icon: "audio-lines",
    theme: "emerald",
    tags: ["audio", "transcription", "decisions"],
    type: "premium",
  },
  {
    id: "charades",
    entry: bundled("charades"),
    surface: CONTAINED,
    capabilityId: "featured-charades",
    name: "Charades",
    category: "Decisions",
    when: "You fancy performing to an audience that scores in probabilities.",
    uses: "Your camera and microphone for a short clip. Clef Omni watches the video with its soundtrack.",
    produces:
      "A ranked list of guesses, a verdict on whether you cheated by talking, and a theatricality score you can argue with.",
    ios: "web-only",
    description:
      "Act out a card on camera and let Clef Omni guess. Sound effects are fine, words are not, and it is listening",
    icon: "clapperboard",
    theme: "rose",
    tags: ["video", "game", "decisions"],
    type: "premium",
  },
  {
    id: "photo-sorter",
    entry: bundled("photo-sorter"),
    surface: CONTAINED,
    capabilityId: "featured-photo-sorter",
    name: "Photo Sorter",
    category: "Decisions",
    when: "You have a pile of images and want them in sensible heaps without looking at each one.",
    uses: "Images you drop in and the piles you name. Clef Omni files each one with a calibrated confidence.",
    produces:
      "Images sorted into your piles, with flags for faces, text and blur, and the ones it is unsure about left for you.",
    ios: "web-only",
    description:
      "Name some piles, drop in a stack of photos and watch them sort themselves. The doubtful ones wait for you",
    icon: "images",
    theme: "amber",
    tags: ["image", "classification", "decisions"],
    type: "premium",
  },
  {
    id: "twenty-questions",
    entry: bundled("twenty-questions"),
    surface: CONTAINED,
    capabilityId: "featured-twenty-questions",
    name: "Twenty Questions",
    category: "Decisions",
    when: "You have a few minutes and a suspicion you could out-think a decision model.",
    uses: "Your yes or no questions. The secret stays sealed on the server until you guess it or give up.",
    produces:
      "Calibrated answers rather than a flat yes or no, plus a warmth reading that tells you when you are close.",
    ios: "web-only",
    description:
      "Guess the secret in twenty yes or no questions. Answers come back as probabilities, so 'probably not' means something",
    icon: "message-circle-question",
    theme: "violet",
    tags: ["text", "game", "decisions"],
    type: "premium",
  },
  {
    id: "polis",
    entry: bundled("polis"),
    surface: WORKSPACE_STUDIO,
    capabilityId: "featured-polis",
    name: "Polis",
    category: "Decisions",
    when: "You want to see what a town of tens of thousands does when you change the rules.",
    uses: "A simulated town in your browser, with a decision model judging how each kind of resident reacts.",
    produces:
      "A living town to watch, laws written in plain English, town polls and side-by-side forks of what happens with and without a change.",
    ios: "web-only",
    description:
      "Run a town of up to 50,000 people, pass laws in plain English, throw disasters at it and watch how everyone reacts",
    icon: "landmark",
    theme: "emerald",
    tags: ["simulation", "game", "decisions"],
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
  category?: string;
  layout: AppSurfaceDefinition["layout"];
}

const REMOTE_APP_SURFACES: Record<AppSurfaceDefinition["layout"], AppSurfaceDefinition> = {
  contained: CONTAINED,
  workspace: { layout: "workspace", loading: "editor" },
};

const remoteAppId = (server: string, tool: string): string =>
  `mcp-${server}-${tool}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

export const getRemoteExperienceCatalog = (
  sources: readonly RemoteAppSource[],
): ProjectExperienceDefinition[] => {
  const seen = new Set<string>();

  return sources.flatMap((source) => {
    const id = remoteAppId(source.server, source.tool);

    if (seen.has(id)) {
      return [];
    }

    seen.add(id);

    return [
      {
        id,
        entry: {
          kind: "remote" as const,
          server: source.server,
          tool: source.tool,
          resource: source.resourceUri,
        },
        surface: REMOTE_APP_SURFACES[source.layout],
        name: source.name,
        description: source.description ?? `An app from ${source.server}.`,
        when: `You want ${source.name} from ${source.server} on its own page.`,
        uses: `Your connection to ${source.server}. It can only read through that connection.`,
        produces: "Whatever the app shows you. Anything that changes something is asked in a chat.",
        ios: "web-only" as const,
        scope: "personal" as const,
        scopeReason: "Apps from your MCP servers use your own connection.",
        category: source.category ?? "Connected",
        tags: ["mcp"],
        requirement: { kind: "capability_kind" as const, capabilityKind: "app" as const },
      },
    ];
  });
};
