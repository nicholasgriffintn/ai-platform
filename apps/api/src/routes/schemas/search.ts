import z from "zod/v4";

export const searchWebSchema = z.object({
  query: z.string(),
  provider: z.enum(["serper", "tavily"]),
  options: z
    .object({
      search_depth: z.enum(["basic", "advanced"]).optional(),
      include_answer: z.boolean().optional(),
      include_raw_content: z.boolean().optional(),
      include_images: z.boolean().optional(),
      country: z.string().optional(),
      location: z.string().optional(),
      language: z.string().optional(),
      timePeriod: z.string().optional(),
      autocorrect: z.boolean().optional(),
      num: z.number().optional(),
      page: z.number().optional(),
    })
    .optional(),
});

export const searchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  position: z.number().optional(),
});

export const webSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    results: z.array(searchResultSchema),
    query: z.string(),
  }),
});
