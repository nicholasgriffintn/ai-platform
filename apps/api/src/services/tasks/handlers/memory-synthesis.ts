import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { z } from "zod/v4";

import { ai } from "~/lib/ai";
import { MemorySynthesisRepository } from "~/repositories/MemorySynthesisRepository";
import { SourceRepository, type SourceRecord } from "~/repositories/SourceRepository";
import { getAuxiliaryModel } from "~/services/models/resolve";
import type { IEnv } from "~/types";

import { defineTask } from "../workflows";

const logger = getLogger({ prefix: "services/tasks/memory-synthesis" });

type CategorizedMemories = Record<string, Array<{ id: string; text: string; category: string }>>;

export const memorySynthesis = defineTask({
  payload: z.object({ namespace: z.string().default("global") }),
  handle: async ({ namespace }, { env, message }) => {
    if (!message.user_id) {
      return {
        status: "error",
        message: "user_id is required for memory synthesis",
      };
    }

    const sourceRepository = new SourceRepository(env);
    const memorySynthesisRepository = new MemorySynthesisRepository(env);

    const memories = await sourceRepository.listPersonalSources(message.user_id, "memory");

    const activeMemories = memories.filter((memory) => {
      const metadata = readMetadata(memory);
      const sourceNamespace =
        typeof metadata.namespace === "string" ? metadata.namespace : "global";

      return sourceNamespace === namespace && memory.status !== "archived";
    });

    if (activeMemories.length === 0) {
      return {
        status: "skipped",
        message: "No active memories to synthesize",
      };
    }

    const existingSynthesis = await memorySynthesisRepository.getActiveSynthesis(
      message.user_id,
      namespace,
    );

    const categorized = categorizeMemories(
      activeMemories.map((memory) => {
        const metadata = readMetadata(memory);

        return {
          id: memory.id,
          text: memory.content ?? "",
          category: typeof metadata.category === "string" ? metadata.category : "general",
        };
      }),
    );

    const synthesis = await generateSynthesis(categorized, existingSynthesis, env);

    const synthesisRecord = await memorySynthesisRepository.createSynthesis({
      user_id: message.user_id,
      namespace,
      synthesis_text: synthesis,
      memory_ids: activeMemories.map((m) => m.id),
      memory_count: activeMemories.length,
      synthesis_version: (existingSynthesis?.synthesis_version ?? 0) + 1,
    });

    if (!synthesisRecord) {
      throw new Error("Failed to create synthesis record");
    }

    if (existingSynthesis) {
      await memorySynthesisRepository.supersedeSynthesis(existingSynthesis.id, synthesisRecord.id);
    }

    logger.info(
      `Memory synthesis completed for user ${message.user_id}, synthesized ${activeMemories.length} memories`,
    );

    return {
      status: "success",
      message: "Memory synthesis completed successfully",
      data: {
        synthesis_id: synthesisRecord.id,
        memory_count: activeMemories.length,
        synthesis_version: synthesisRecord.synthesis_version,
      },
    };
  },
});

function readMetadata(memory: Pick<SourceRecord, "metadata">): Record<string, unknown> {
  const value =
    typeof memory.metadata === "string" ? safeParseJson(memory.metadata) : memory.metadata;

  return isRecord(value) ? value : {};
}

function categorizeMemories(
  memories: Array<{ id: string; text: string; category: string }>,
): CategorizedMemories {
  const categorized: CategorizedMemories = {};

  for (const memory of memories) {
    const category = memory.category || "general";

    if (!categorized[category]) {
      categorized[category] = [];
    }

    categorized[category].push(memory);
  }

  return categorized;
}

async function generateSynthesis(
  categorized: CategorizedMemories,
  existing: any,
  env: IEnv,
): Promise<string> {
  const memoriesText = Object.entries(categorized)
    .map(
      ([category, mems]) => `
## ${category.toUpperCase()}
${mems.map((m) => `- ${m.text}`).join("\n")}
`,
    )
    .join("\n");

  const prompt = `You are creating a memory synthesis for an AI assistant.

Consolidate the following memories into a coherent, well-organized summary:

${memoriesText}

${existing ? `\nPrevious synthesis:\n${existing.synthesis_text}\n` : ""}

Today's date is ${new Date().toISOString().split("T")[0]}.

Create a clear, factual synthesis that:
1. Groups related information
2. Resolves any conflicts (prefer recent information)
3. Removes redundancies
4. Maintains specific dates and facts
5. Is easy to scan and reference

Format as a structured document with clear sections.`;

  try {
    const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModel(env);

    return await ai.generateText({
      env,
      model: modelToUse,
      provider: providerToUse,
      prompt,
      reasoning: { effort: "none" },
    });
  } catch (error) {
    logger.error("Failed to generate synthesis with AI:", error);

    return Object.entries(categorized)
      .map(
        ([category, mems]) =>
          `## ${category.toUpperCase()}\n${mems.map((m) => `- ${m.text}`).join("\n")}`,
      )
      .join("\n\n");
  }
}
