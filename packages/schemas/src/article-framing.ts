import z from "zod/v4";

import { documentEditorialGradeSchema } from "./documents.js";

export const SOURCE_FRAMING_METADATA_KEY = "framing";

export const ARTICLE_SLANTS = ["balanced", "leans", "one_sided"] as const;

export const articleSlantSchema = z.enum(ARTICLE_SLANTS);

export const ARTICLE_SLANT_LABELS = {
  balanced: "Balanced",
  leans: "Leans one way",
  one_sided: "One-sided",
} as const satisfies Record<(typeof ARTICLE_SLANTS)[number], string>;

function text() {
  return z.string().trim().min(1);
}

export const articleFramingDraftSchema = z
  .object({
    overview: text().describe("Two short sentences at most on how the article frames its subject."),
    slant: articleSlantSchema.describe(
      "balanced when competing views get fair weight, leans when it favours one side but reports the others, one_sided when only one side appears.",
    ),
    tone: text().describe("The tone in two or three words, such as measured, alarmed or admiring."),
    sourcing: text().describe(
      "In one or two sentences, who the article quotes or relies on and what goes unsupported.",
    ),
    loadedLanguage: z
      .array(
        z
          .object({
            quote: text().describe("Wording copied exactly from the article."),
            note: text().describe("What that wording does to the reader, in one short sentence."),
          })
          .strict(),
      )
      .max(5)
      .describe("The most loaded or one-sided phrases. Leave it empty when there are none."),
    missingPerspectives: z
      .array(text())
      .max(4)
      .describe("Viewpoints or facts a reader would need that the article leaves out."),
  })
  .strict();

export const sourceFramingSchema = articleFramingDraftSchema.extend({
  grade: documentEditorialGradeSchema.shape.grade.optional(),
  contentHash: z.string().min(1),
  generatedAt: z.string().min(1),
});

export type ArticleSlant = z.infer<typeof articleSlantSchema>;
export type ArticleFramingDraft = z.infer<typeof articleFramingDraftSchema>;
export type SourceFraming = z.infer<typeof sourceFramingSchema>;

export function readSourceFraming(
  metadata: Record<string, unknown> | null | undefined,
): SourceFraming | null {
  const parsed = sourceFramingSchema.safeParse(metadata?.[SOURCE_FRAMING_METADATA_KEY]);

  return parsed.success ? parsed.data : null;
}
