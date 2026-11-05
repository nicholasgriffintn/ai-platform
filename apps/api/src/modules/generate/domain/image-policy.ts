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
  "The safety check couldn't run, so nothing was generated. Check that any reference images are PNG, JPEG or WebP files under 4 MiB, then try again.";

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

const IMAGE_VALUE_PATTERN = /^(https?:|data:image\/)/i;
const NON_IMAGE_MEDIA_FIELD_PATTERN = /(^|_)(audio|video)s?$/i;

export function readGenerationInput(input: Record<string, unknown>): {
  text: string;
  images: string[];
} {
  const text: string[] = [];
  const images: string[] = [];

  for (const [name, value] of Object.entries(input)) {
    if (NON_IMAGE_MEDIA_FIELD_PATTERN.test(name)) {
      continue;
    }

    for (const entry of [value].flat()) {
      if (typeof entry === "string" && entry.trim()) {
        (IMAGE_VALUE_PATTERN.test(entry) ? images : text).push(entry);
      }
    }
  }

  return { text: text.join("\n"), images };
}
