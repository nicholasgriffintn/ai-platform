import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  DECK_CAPABILITY_ID,
  DECK_OUTPUT_KIND,
  deckOutputContentSchema,
  DOCUMENT_CAPABILITY_ID,
  DOCUMENT_MAX_BODY,
  DOCUMENT_OUTPUT_KIND,
  FLASHCARDS_OUTPUT_KIND,
  flashcardsOutputContentSchema,
  MIND_MAP_OUTPUT_KIND,
  mindMapOutputContentSchema,
  QUIZ_OUTPUT_KIND,
  quizOutputContentSchema,
  SHEET_CAPABILITY_ID,
  SHEET_OUTPUT_KIND,
  sheetOutputContentSchema,
  STUDY_CAPABILITY_ID,
  VIDEO_OVERVIEW_MAX_SCENES,
  VIDEO_OVERVIEW_OUTPUT_KIND,
  videoOverviewSceneDraftSchema,
  type NotebookStudioRequest,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getTierModel } from "~/modules/models/application/resolve";
import { NOTEBOOK_MODEL_TIER } from "~/modules/notebooks/domain/notebook";
import {
  DECK_LENGTH_GUIDANCE,
  DECK_STYLE_GUIDANCE,
  REPORT_TEMPLATE_GUIDANCE,
  STUDY_COUNT_GUIDANCE,
  STUDY_DIFFICULTY_GUIDANCE,
  VIDEO_FORMAT_GUIDANCE,
} from "~/modules/notebooks/domain/studio-guidance";

export type OutputStudioRequest = Exclude<
  NotebookStudioRequest,
  { kind: "audio" } | { kind: "infographic" }
>;

export interface StudioOutputShape {
  capabilityId: string;
  outputKind: string;
  pendingTitle: string;
}

export interface StudioDraft {
  title: string;
  content: Record<string, unknown>;
}

const titleField = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .describe("What the reader would call this, as a short title.");

export const STUDIO_OUTPUT_SHAPES: Record<OutputStudioRequest["kind"], StudioOutputShape> = {
  deck: {
    capabilityId: DECK_CAPABILITY_ID,
    outputKind: DECK_OUTPUT_KIND,
    pendingTitle: "Slide deck",
  },
  sheet: {
    capabilityId: SHEET_CAPABILITY_ID,
    outputKind: SHEET_OUTPUT_KIND,
    pendingTitle: "Data table",
  },
  report: {
    capabilityId: DOCUMENT_CAPABILITY_ID,
    outputKind: DOCUMENT_OUTPUT_KIND,
    pendingTitle: "Report",
  },
  mind_map: {
    capabilityId: STUDY_CAPABILITY_ID,
    outputKind: MIND_MAP_OUTPUT_KIND,
    pendingTitle: "Mind map",
  },
  flashcards: {
    capabilityId: STUDY_CAPABILITY_ID,
    outputKind: FLASHCARDS_OUTPUT_KIND,
    pendingTitle: "Flashcards",
  },
  quiz: { capabilityId: STUDY_CAPABILITY_ID, outputKind: QUIZ_OUTPUT_KIND, pendingTitle: "Quiz" },
  video: {
    capabilityId: STUDY_CAPABILITY_ID,
    outputKind: VIDEO_OVERVIEW_OUTPUT_KIND,
    pendingTitle: "Video overview",
  },
};

async function generateStudioObject<TObject>(
  context: ServiceContext,
  params: { name: string; schema: z.ZodType<TObject>; system: string; material: string },
): Promise<TObject> {
  const user = context.requireUser();
  const { model, provider, effort } = await getTierModel(context.env, user, NOTEBOOK_MODEL_TIER);
  const { object } = await ai.generateObject({
    env: context.env,
    user,
    model,
    provider,
    reasoning_effort: effort,
    disable_functions: true,
    name: params.name,
    schema: params.schema,
    system: params.system,
    prompt: params.material,
  });

  return object;
}

export async function writeStudioDraft(
  context: ServiceContext,
  request: OutputStudioRequest,
  material: string,
): Promise<StudioDraft> {
  const shared = { language: request.language, focus: request.focus };

  switch (request.kind) {
    case "deck": {
      const draft = await generateStudioObject(context, {
        name: "notebook_deck",
        schema: z.object({ title: titleField, slides: deckOutputContentSchema.shape.slides }),
        system: renderPrompt("notebooks/studio/deck", {
          ...shared,
          style: DECK_STYLE_GUIDANCE[request.style],
          length: DECK_LENGTH_GUIDANCE[request.length],
        }),
        material,
      });

      return { title: draft.title, content: { format: "slides", slides: draft.slides } };
    }

    case "sheet": {
      const draft = await generateStudioObject(context, {
        name: "notebook_sheet",
        schema: z.object({ title: titleField, tables: sheetOutputContentSchema.shape.tables }),
        system: renderPrompt("notebooks/studio/sheet", shared),
        material,
      });

      return { title: draft.title, content: { format: "tables", tables: draft.tables } };
    }

    case "report": {
      const draft = await generateStudioObject(context, {
        name: "notebook_report",
        schema: z.object({
          title: titleField,
          body: z.string().min(1).max(DOCUMENT_MAX_BODY).describe("The report in Markdown."),
        }),
        system: renderPrompt("notebooks/studio/report", {
          ...shared,
          template: REPORT_TEMPLATE_GUIDANCE[request.template],
        }),
        material,
      });

      return { title: draft.title, content: { format: "markdown", body: draft.body } };
    }

    case "mind_map": {
      const draft = await generateStudioObject(context, {
        name: "notebook_mind_map",
        schema: z.object({ title: titleField, root: mindMapOutputContentSchema.shape.root }),
        system: renderPrompt("notebooks/studio/mind-map", shared),
        material,
      });

      return { title: draft.title, content: { format: "mind_map", root: draft.root } };
    }

    case "flashcards": {
      const draft = await generateStudioObject(context, {
        name: "notebook_flashcards",
        schema: z.object({ title: titleField, cards: flashcardsOutputContentSchema.shape.cards }),
        system: renderPrompt("notebooks/studio/flashcards", {
          ...shared,
          count: STUDY_COUNT_GUIDANCE[request.count],
          difficulty: STUDY_DIFFICULTY_GUIDANCE[request.difficulty],
        }),
        material,
      });

      return { title: draft.title, content: { format: "flashcards", cards: draft.cards } };
    }

    case "quiz": {
      const draft = await generateStudioObject(context, {
        name: "notebook_quiz",
        schema: z.object({ title: titleField, questions: quizOutputContentSchema.shape.questions }),
        system: renderPrompt("notebooks/studio/quiz", {
          ...shared,
          count: STUDY_COUNT_GUIDANCE[request.count],
          difficulty: STUDY_DIFFICULTY_GUIDANCE[request.difficulty],
        }),
        material,
      });

      return { title: draft.title, content: { format: "quiz", questions: draft.questions } };
    }

    case "video": {
      const draft = await generateStudioObject(context, {
        name: "notebook_video",
        schema: z.object({
          title: titleField,
          scenes: z.array(videoOverviewSceneDraftSchema).min(1).max(VIDEO_OVERVIEW_MAX_SCENES),
        }),
        system: renderPrompt("notebooks/studio/video", {
          ...shared,
          format: VIDEO_FORMAT_GUIDANCE[request.format],
        }),
        material,
      });

      return {
        title: draft.title,
        content: {
          format: "video_overview",
          style: request.style,
          scenes: draft.scenes.map((scene) => ({ ...scene, image: false })),
          timings: [],
        },
      };
    }
  }
}

export async function writeInfographicPrompt(
  context: ServiceContext,
  params: { language: string; focus?: string; orientation: string; material: string },
): Promise<{ title: string; prompt: string }> {
  return generateStudioObject(context, {
    name: "notebook_infographic",
    schema: z.object({
      title: titleField,
      prompt: z
        .string()
        .trim()
        .min(1)
        .max(4_000)
        .describe(
          "The full image prompt describing the infographic layout and every piece of text.",
        ),
    }),
    system: renderPrompt("notebooks/studio/infographic", {
      language: params.language,
      focus: params.focus,
      orientation: params.orientation,
    }),
    material: params.material,
  });
}
