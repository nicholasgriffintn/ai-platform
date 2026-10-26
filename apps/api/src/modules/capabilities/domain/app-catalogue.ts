import type {
  AppIosDecision,
  AppScope,
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
  runtime: ProjectExperienceRuntime;
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

export const EXPERIENCES: ExperienceDefinition[] = [
  {
    id: "strudel",
    runtime: "strudel",
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
    type: "normal",
  },
  {
    id: "sites",
    runtime: "sites",
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
    type: "normal",
  },
  {
    id: "verbatim",
    runtime: "verbatim",
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
    runtime: "charades",
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
    type: "normal",
  },
  {
    id: "photo-sorter",
    runtime: "photo-sorter",
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
    type: "normal",
  },
  {
    id: "twenty-questions",
    runtime: "twenty-questions",
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
    type: "normal",
  },
  {
    id: "benchmarks",
    runtime: "benchmarks",
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
    type: "normal",
  },
];

export const getExperienceCatalog = (): ExperienceDefinition[] => EXPERIENCES;

export const getProjectExperienceCatalog = (): ProjectExperienceDefinition[] =>
  EXPERIENCES.map(
    ({
      id,
      runtime,
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
      runtime,
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
