import { knowledgePathSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { gitObjectShaSchema } from "./github-reader";

export const knowledgeCheckpointSchema = z
  .object({
    runId: z.uuid(),
    commit: gitObjectShaSchema,
    visited: z.number().int().min(0).max(10_000),
    queue: z
      .array(
        z.object({
          path: knowledgePathSchema,
          sha: gitObjectShaSchema,
          type: z.enum(["tree", "blob"]),
        }),
      )
      .max(10_000),
  })
  .strict();

export type KnowledgeCheckpoint = z.infer<typeof knowledgeCheckpointSchema>;
export const isKnowledgeDocument = (path: string) => /\.(?:md|mdx|txt|rst|adoc)$/i.test(path);
