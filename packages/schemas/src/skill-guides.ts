import z from "zod/v4";

import { listSchema } from "./platform/list.js";
import { polyPlaceSchema } from "./poly.js";

export const SKILL_GUIDE_MAX_STARTERS = 6;

export const skillGuideSchema = z.object({
  place: polyPlaceSchema,
  skillId: z.string().min(1),
  name: z.string().min(1),
  opening: z.string().min(1),
  starters: z.array(z.string().min(1)).max(SKILL_GUIDE_MAX_STARTERS),
});

export const skillGuideListResponseSchema = listSchema(skillGuideSchema);

export type SkillGuide = z.infer<typeof skillGuideSchema>;
