import type {
  VideoOverviewStyle,
  NotebookDeckLength,
  NotebookDeckStyle,
  NotebookInfographicOrientation,
  NotebookReportTemplate,
  NotebookStudyCount,
  NotebookStudyDifficulty,
  NotebookVideoFormat,
} from "@ngriffin_uk/polychat-schemas";

export const DECK_STYLE_GUIDANCE: Record<NotebookDeckStyle, string> = {
  detailed:
    "Detailed deck: full explanatory text on each slide so it reads well on its own or by email.",
  presenter:
    "Presenter slides: sparse talking points on the slides, with the explanation in the speaker notes.",
};

export const DECK_LENGTH_GUIDANCE: Record<NotebookDeckLength, string> = {
  short: "About six slides.",
  default: "About twelve slides.",
  long: "About twenty slides.",
};

export const REPORT_TEMPLATE_GUIDANCE: Record<NotebookReportTemplate, string> = {
  briefing:
    "Briefing document: an executive summary, then the key themes and findings, then open questions.",
  study_guide:
    "Study guide: key concepts with definitions, a short-answer quiz with an answer key, and essay questions.",
  faq: "FAQ: the questions a newcomer would ask, each answered from the sources.",
  blog_post: "Blog post: an engaging article for a general reader with a clear headline.",
  custom: "A report shaped by the reader's focus below.",
};

export const STUDY_COUNT_GUIDANCE: Record<NotebookStudyCount, string> = {
  fewer: "About eight.",
  standard: "About fifteen.",
  more: "About twenty-five.",
};

export const STUDY_DIFFICULTY_GUIDANCE: Record<NotebookStudyDifficulty, string> = {
  easy: "Easy: recall of stated facts and definitions.",
  medium: "Medium: understanding how ideas connect.",
  hard: "Hard: applying ideas and weighing evidence across sources.",
};

export const VIDEO_FORMAT_GUIDANCE: Record<NotebookVideoFormat, string> = {
  explainer: "Explainer: eight to twelve scenes that build a structured, connected overview.",
  brief: "Brief: four to six scenes covering only the core ideas.",
};

export const VIDEO_STYLE_PROMPTS: Record<VideoOverviewStyle, string> = {
  classic: "Clean editorial illustration, flat shapes, soft shading, calm limited palette",
  whiteboard: "Hand-drawn black marker sketch on a white whiteboard, simple icons and arrows",
  watercolour: "Loose watercolour painting, soft washes of colour on textured paper",
  retro_print: "Retro risograph print, two-tone grainy inks, bold mid-century shapes",
  heritage: "Heritage engraving style, fine cross-hatched ink lines, muted sepia tones",
  papercraft: "Layered cut paper diorama, crisp paper edges and soft drop shadows",
  kawaii: "Cute kawaii illustration, rounded friendly characters, pastel colours",
  anime: "Anime key art, cel shading, dramatic lighting and vivid colour",
};

export const INFOGRAPHIC_SIZES: Record<
  NotebookInfographicOrientation,
  { aspectRatio: string; width: number; height: number }
> = {
  landscape: { aspectRatio: "16:9", width: 1280, height: 720 },
  portrait: { aspectRatio: "9:16", width: 720, height: 1280 },
  square: { aspectRatio: "1:1", width: 1024, height: 1024 },
};
