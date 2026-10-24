import {
  DECK_OUTPUT_KIND,
  DOCUMENT_OUTPUT_KIND,
  FLASHCARDS_OUTPUT_KIND,
  MIND_MAP_OUTPUT_KIND,
  QUIZ_OUTPUT_KIND,
  SHEET_OUTPUT_KIND,
  VIDEO_OVERVIEW_OUTPUT_KIND,
  notebookDeckLengthSchema,
  notebookDeckStyleSchema,
  notebookInfographicOrientationSchema,
  notebookReportTemplateSchema,
  notebookStudioRequestSchema,
  notebookStudyCountSchema,
  notebookStudyDifficultySchema,
  notebookVideoFormatSchema,
  PODCAST_FORMATS,
  podcastFormatSchema,
  podcastLengthSchema,
  videoOverviewStyleSchema,
  VIDEO_OVERVIEW_STYLE_LABELS,
  type NotebookStudioKind,
} from "@ngriffin_uk/polychat-schemas";
import {
  AudioLines,
  ChartPie,
  CircleHelp,
  Clapperboard,
  FileText,
  Layers,
  type LucideIcon,
  Network,
  Presentation,
  Table2,
} from "lucide-react";

export interface StudioChoice {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
}

export interface StudioTile {
  kind: NotebookStudioKind;
  label: string;
  description: string;
  icon: LucideIcon;
  choices: readonly StudioChoice[];
}

function options<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): readonly { value: string; label: string }[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

const LENGTH_CHOICE: StudioChoice = {
  name: "length",
  label: "Length",
  options: options(podcastLengthSchema.options, {
    short: "Shorter",
    default: "Default",
    long: "Longer",
  }),
};

const COUNT_CHOICE: StudioChoice = {
  name: "count",
  label: "How many",
  options: options(notebookStudyCountSchema.options, {
    fewer: "Fewer",
    standard: "Standard",
    more: "More",
  }),
};

const DIFFICULTY_CHOICE: StudioChoice = {
  name: "difficulty",
  label: "Difficulty",
  options: options(notebookStudyDifficultySchema.options, {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  }),
};

export const STUDIO_TILES: readonly StudioTile[] = [
  {
    kind: "audio",
    label: "Audio overview",
    description: "Two hosts talk the sources through.",
    icon: AudioLines,
    choices: [
      {
        name: "format",
        label: "Format",
        options: podcastFormatSchema.options.map((value) => ({
          value,
          label: PODCAST_FORMATS[value].label,
        })),
      },
      LENGTH_CHOICE,
    ],
  },
  {
    kind: "deck",
    label: "Slide deck",
    description: "Slides with speaker notes.",
    icon: Presentation,
    choices: [
      {
        name: "style",
        label: "Style",
        options: options(notebookDeckStyleSchema.options, {
          detailed: "Detailed deck",
          presenter: "Presenter slides",
        }),
      },
      {
        name: "length",
        label: "Length",
        options: options(notebookDeckLengthSchema.options, {
          short: "Shorter",
          default: "Default",
          long: "Longer",
        }),
      },
    ],
  },
  {
    kind: "video",
    label: "Video overview",
    description: "Narrated scenes in a style of your choosing.",
    icon: Clapperboard,
    choices: [
      {
        name: "format",
        label: "Format",
        options: options(notebookVideoFormatSchema.options, {
          explainer: "Explainer",
          brief: "Brief",
        }),
      },
      {
        name: "style",
        label: "Visual style",
        options: options(videoOverviewStyleSchema.options, VIDEO_OVERVIEW_STYLE_LABELS),
      },
    ],
  },
  {
    kind: "mind_map",
    label: "Mind map",
    description: "Topics and how they branch.",
    icon: Network,
    choices: [],
  },
  {
    kind: "report",
    label: "Report",
    description: "A briefing, study guide, FAQ or post.",
    icon: FileText,
    choices: [
      {
        name: "template",
        label: "Report",
        options: options(notebookReportTemplateSchema.options, {
          briefing: "Briefing document",
          study_guide: "Study guide",
          faq: "FAQ",
          blog_post: "Blog post",
          custom: "Your own",
        }),
      },
    ],
  },
  {
    kind: "flashcards",
    label: "Flashcards",
    description: "Cards that test what stuck.",
    icon: Layers,
    choices: [COUNT_CHOICE, DIFFICULTY_CHOICE],
  },
  {
    kind: "quiz",
    label: "Quiz",
    description: "Multiple choice, with explanations.",
    icon: CircleHelp,
    choices: [COUNT_CHOICE, DIFFICULTY_CHOICE],
  },
  {
    kind: "infographic",
    label: "Infographic",
    description: "One picture of the main points.",
    icon: ChartPie,
    choices: [
      {
        name: "orientation",
        label: "Orientation",
        options: options(notebookInfographicOrientationSchema.options, {
          landscape: "Landscape",
          portrait: "Portrait",
          square: "Square",
        }),
      },
    ],
  },
  {
    kind: "sheet",
    label: "Data table",
    description: "The facts, in rows and columns.",
    icon: Table2,
    choices: [],
  },
];

export function defaultStudioChoices(tile: StudioTile): Record<string, string> {
  const defaults: Record<string, unknown> = notebookStudioRequestSchema.parse({ kind: tile.kind });

  return Object.fromEntries(
    tile.choices.map((choice) => {
      const value = defaults[choice.name];

      return [choice.name, typeof value === "string" ? value : ""];
    }),
  );
}

const OUTPUT_KIND_TILES: Record<string, NotebookStudioKind> = {
  [DECK_OUTPUT_KIND]: "deck",
  [SHEET_OUTPUT_KIND]: "sheet",
  [DOCUMENT_OUTPUT_KIND]: "report",
  [MIND_MAP_OUTPUT_KIND]: "mind_map",
  [FLASHCARDS_OUTPUT_KIND]: "flashcards",
  [QUIZ_OUTPUT_KIND]: "quiz",
  [VIDEO_OVERVIEW_OUTPUT_KIND]: "video",
};

export function studioTileForOutputKind(kind: string): StudioTile | undefined {
  const tileKind = OUTPUT_KIND_TILES[kind];

  return STUDIO_TILES.find((tile) => tile.kind === tileKind);
}

export function studioTileForSource(source: { kind: string }): StudioTile | undefined {
  return STUDIO_TILES.find(
    (tile) => tile.kind === (source.kind === "podcast" ? "audio" : "infographic"),
  );
}
