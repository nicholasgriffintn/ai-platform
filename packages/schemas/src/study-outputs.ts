import z from "zod/v4";

export const MIND_MAP_OUTPUT_KIND = "mind_map";
export const FLASHCARDS_OUTPUT_KIND = "flashcards";
export const QUIZ_OUTPUT_KIND = "quiz";
export const VIDEO_OVERVIEW_OUTPUT_KIND = "video_overview";
export const STUDY_CAPABILITY_ID = "notebook-studio";

export const FLASHCARDS_MAX_CARDS = 60;
export const QUIZ_MAX_QUESTIONS = 30;
export const VIDEO_OVERVIEW_MAX_SCENES = 16;

export interface MindMapNode {
  label: string;
  summary?: string;
  children?: MindMapNode[];
}

const mindMapNodeFields = {
  label: z.string().trim().min(1).describe("A short topic name."),
  summary: z.string().trim().optional().describe("One sentence on what the sources say about it."),
};

function mindMapBranchSchema<TChild extends z.ZodType<MindMapNode>>(child: TChild) {
  return z
    .object({
      ...mindMapNodeFields,
      children: z.array(child).max(8).optional().describe("Narrower topics under this one."),
    })
    .strict();
}

const mindMapLeafSchema = z.object(mindMapNodeFields).strict();

export const mindMapNodeSchema = mindMapBranchSchema(
  mindMapBranchSchema(mindMapBranchSchema(mindMapLeafSchema)),
);

export const mindMapOutputContentSchema = z
  .object({
    format: z.literal("mind_map"),
    root: mindMapNodeSchema,
  })
  .strict();

export const flashcardSchema = z
  .object({
    front: z.string().trim().min(1).describe("A question or term."),
    back: z.string().trim().min(1).describe("The answer, as the sources give it."),
  })
  .strict();

export const flashcardsOutputContentSchema = z
  .object({
    format: z.literal("flashcards"),
    cards: z.array(flashcardSchema).min(1).max(FLASHCARDS_MAX_CARDS),
  })
  .strict();

export const quizQuestionSchema = z
  .object({
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(2).max(5),
    answerIndex: z.number().int().min(0).max(4).describe("Zero-based index of the right option."),
    explanation: z.string().trim().min(1).describe("Why that answer is right."),
  })
  .strict()
  .refine((question) => question.answerIndex < question.options.length, {
    error: "The answer must be one of the options",
    path: ["answerIndex"],
  });

export const quizOutputContentSchema = z
  .object({
    format: z.literal("quiz"),
    questions: z.array(quizQuestionSchema).min(1).max(QUIZ_MAX_QUESTIONS),
  })
  .strict();

export const videoOverviewStyleSchema = z.enum([
  "classic",
  "whiteboard",
  "watercolour",
  "retro_print",
  "heritage",
  "papercraft",
  "kawaii",
  "anime",
]);

export const VIDEO_OVERVIEW_STYLE_LABELS: Record<
  z.infer<typeof videoOverviewStyleSchema>,
  string
> = {
  classic: "Classic",
  whiteboard: "Whiteboard",
  watercolour: "Watercolour",
  retro_print: "Retro print",
  heritage: "Heritage",
  papercraft: "Papercraft",
  kawaii: "Kawaii",
  anime: "Anime",
};

export const videoOverviewSceneDraftSchema = z
  .object({
    title: z.string().trim().min(1).describe("What the scene is about, as a short headline."),
    caption: z
      .string()
      .trim()
      .default("")
      .describe("At most one short line of on-screen text, such as a key figure. Often empty."),
    visual: z
      .string()
      .trim()
      .min(1)
      .describe(
        "The illustration for this scene: the subject, setting and composition, as a picture with no words in it.",
      ),
    narration: z
      .string()
      .trim()
      .min(1)
      .describe("What the narrator says over this scene, written to be spoken."),
  })
  .strict();

export const videoOverviewSceneSchema = videoOverviewSceneDraftSchema
  .extend({ image: z.boolean().default(false) })
  .strict();

export const videoOverviewTimingSchema = z
  .object({ start: z.number().nonnegative(), end: z.number().nonnegative() })
  .strict();

export const videoOverviewOutputContentSchema = z
  .object({
    format: z.literal("video_overview"),
    style: videoOverviewStyleSchema,
    scenes: z.array(videoOverviewSceneSchema).min(1).max(VIDEO_OVERVIEW_MAX_SCENES),
    timings: z.array(videoOverviewTimingSchema).default([]),
  })
  .strict();

export const studyProgressSchema = z
  .object({
    known: z.array(z.number().int().nonnegative()).max(FLASHCARDS_MAX_CARDS).default([]),
    missed: z.array(z.number().int().nonnegative()).max(FLASHCARDS_MAX_CARDS).default([]),
    answers: z.record(z.string(), z.number().int().min(0).max(4)).default({}),
  })
  .strict();

export type MindMapOutputContent = z.infer<typeof mindMapOutputContentSchema>;
export type Flashcard = z.infer<typeof flashcardSchema>;
export type FlashcardsOutputContent = z.infer<typeof flashcardsOutputContentSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizOutputContent = z.infer<typeof quizOutputContentSchema>;
export type VideoOverviewStyle = z.infer<typeof videoOverviewStyleSchema>;
export type VideoOverviewSceneDraft = z.infer<typeof videoOverviewSceneDraftSchema>;
export type VideoOverviewScene = z.infer<typeof videoOverviewSceneSchema>;
export type VideoOverviewTiming = z.infer<typeof videoOverviewTimingSchema>;
export type VideoOverviewOutputContent = z.infer<typeof videoOverviewOutputContentSchema>;
export type StudyProgress = z.infer<typeof studyProgressSchema>;
