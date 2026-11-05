import {
  modelHasOutputModality,
  readDecisionNoul,
  type DecisionAnswer,
  type DecisionQuestions,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";

export const IMAGE_POLICY_CLASSIFIER = {
  provider: "workers-ai",
  model: "@cf/cloudflare/clef-omni",
} as const;

export const IMAGE_POLICY_BLOCK_THRESHOLD = 0.5;

export const IMAGE_POLICY_REFUSAL =
  "I can't make that. Sexualised depictions of minors and intimate images of real people without their consent aren't allowed.";

export const IMAGE_POLICY_UNAVAILABLE =
  "The safety check couldn't run, so nothing was generated or kept. Try again, or use a smaller PNG, JPEG or WebP reference image.";

export const REFERENCE_VIDEO_UNREADABLE =
  "The safety check can't read that reference video, so nothing was generated. Use an MP4 or WebM file under 16 MiB.";

export const GENERATED_IMAGE_REVIEW =
  "Judge the supplied image, which an AI model has just generated.";

export const IMAGE_POLICY_QUESTIONS = {
  minor_sexualised: {
    type: "noul",
    instructions:
      "Would the requested picture or video, taking any supplied images into account, show someone who is or appears to be under 18 in a sexual or sexualised way?",
    criteria: {
      true: "A sexual, nude or sexualised depiction of a child or of someone presented as a child, whether real or fictional, photographic or drawn",
      false:
        "No sexual content, everyone shown is clearly an adult, or children appear only in ordinary non-sexual settings",
    },
  },
  intimate_real_person: {
    type: "noul",
    instructions:
      "Would the requested picture or video, taking any supplied images into account, show a real, identifiable person nude, sexually or in an intimate state, including by altering a supplied image of them?",
    criteria: {
      true: "An intimate or sexual depiction of a named or pictured real person, or an edit that removes clothing or adds sexual content to an image of a real person",
      false:
        "Fictional characters, ordinary portraits or edits of real people, or content with no intimate or sexual element",
    },
  },
} as const satisfies DecisionQuestions;

export type ImagePolicyViolation = keyof typeof IMAGE_POLICY_QUESTIONS;

const IMAGE_POLICY_VIOLATIONS: readonly ImagePolicyViolation[] = [
  "minor_sexualised",
  "intimate_real_person",
];

export function readImagePolicyViolations(
  answers: Record<string, DecisionAnswer>,
): ImagePolicyViolation[] {
  return IMAGE_POLICY_VIOLATIONS.filter(
    (id) => readDecisionNoul(answers, id) >= IMAGE_POLICY_BLOCK_THRESHOLD,
  );
}

export function producesVisualMedia(model: Pick<ModelConfigItem, "modalities">): boolean {
  return modelHasOutputModality(model, "image") || modelHasOutputModality(model, "video");
}

const MEDIA_VALUE_PATTERN = /^(https?:|data:(image|video)\/)/i;
const AUDIO_FIELD_PATTERN = /(^|_)audios?(_url)?$/i;
const VIDEO_FIELD_PATTERN = /(^|_)videos?(_url)?$/i;

export function readGenerationInput(input: Record<string, unknown>): {
  text: string;
  images: string[];
  videos: string[];
} {
  const text: string[] = [];
  const images: string[] = [];
  const videos: string[] = [];

  for (const [name, value] of Object.entries(input)) {
    if (AUDIO_FIELD_PATTERN.test(name)) {
      continue;
    }

    for (const entry of [value].flat()) {
      if (typeof entry !== "string" || !entry.trim()) {
        continue;
      }

      if (!MEDIA_VALUE_PATTERN.test(entry)) {
        text.push(entry);
      } else if (VIDEO_FIELD_PATTERN.test(name) || /^data:video\//i.test(entry)) {
        videos.push(entry);
      } else {
        images.push(entry);
      }
    }
  }

  return { text: text.join("\n"), images, videos };
}
