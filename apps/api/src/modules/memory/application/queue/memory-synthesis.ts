import { buildMemorySynthesisPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  MEMORY_SYNTHESIS_NAMESPACE,
  memoryReflectionTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";
import { z } from "zod/v4";

import { ai } from "~/infrastructure/ai";
import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { reflectTeammateMemory } from "~/modules/memory-documents/application/reflection";
import { readMemoryDocumentDetails } from "~/modules/memory-documents/domain/details";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { MemorySynthesisRepository } from "~/modules/memory/infrastructure/MemorySynthesisRepository";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { defineTask } from "~/modules/queue/application/workflows";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/tasks/memory-synthesis" });

type CategorizedMemories = Record<string, Array<{ id: string; text: string; category: string }>>;

export const memorySynthesis = defineTask({
  payload: z.object({}),
  handle: async (_input, { env, message }) => {
    if (!message.user_id) {
      return {
        status: "error",
        message: "user_id is required for memory synthesis",
      };
    }

    const memorySynthesisRepository = new MemorySynthesisRepository(env);
    const activeMemories = await new MemoryDocumentRepository(env).listDocuments({
      scopeType: "personal",
      scopeId: String(message.user_id),
    });

    if (activeMemories.length === 0) {
      return {
        status: "skipped",
        message: "No memory documents to synthesise",
      };
    }

    const existingSynthesis = await memorySynthesisRepository.getActiveSynthesis(
      message.user_id,
      MEMORY_SYNTHESIS_NAMESPACE,
    );

    const categorized: CategorizedMemories = Object.fromEntries(
      activeMemories.map((document) => {
        const { description } = readMemoryDocumentDetails(document);

        return [
          description ? `${document.name}: ${description}` : document.name,
          [{ id: document.id, text: document.content, category: document.name }],
        ];
      }),
    );

    const synthesisOwner = await createServiceContext({ env })
      .repositories.get(UserRepository)
      .getUserById(message.user_id);
    const synthesis = await generateSynthesis(
      categorized,
      existingSynthesis,
      env,
      synthesisOwner ?? undefined,
    );

    const synthesisRecord = await memorySynthesisRepository.createSynthesis({
      user_id: message.user_id,
      namespace: MEMORY_SYNTHESIS_NAMESPACE,
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

async function generateSynthesis(
  categorized: CategorizedMemories,
  existing: any,
  env: IEnv,
  user?: IUser,
): Promise<string> {
  const memoriesText = Object.entries(categorized)
    .map(
      ([category, mems]) => `
## ${category.toUpperCase()}
${mems.map((m) => m.text).join("\n")}
`,
    )
    .join("\n");

  const prompt = buildMemorySynthesisPrompt({
    memories: memoriesText,
    existingSynthesis: existing?.synthesis_text,
    date: new Date(),
  });

  try {
    const {
      model: modelToUse,
      provider: providerToUse,
      effort,
    } = await getAuxiliaryModel(env, user);

    return await ai.generateText({
      env,
      model: modelToUse,
      provider: providerToUse,
      prompt,
      reasoning_effort: effort,
      disable_functions: true,
    });
  } catch (error) {
    logger.error("Failed to generate synthesis with AI:", error);

    return Object.entries(categorized)
      .map(
        ([category, mems]) => `## ${category.toUpperCase()}\n${mems.map((m) => m.text).join("\n")}`,
      )
      .join("\n\n");
  }
}

export const memoryReflection = defineTask({
  payload: memoryReflectionTaskDataSchema,
  handle: async (input, { env, message, execution }) => {
    if (!message.user_id) {
      return { status: "error", message: "Memory maintenance requires an owner" };
    }

    const user = await createServiceContext({ env })
      .repositories.get(UserRepository)
      .getUserById(message.user_id);

    if (!user) {
      return { status: "skipped", message: "Memory owner no longer exists" };
    }

    const outcome = await reflectTeammateMemory(
      createServiceContext({ env, user }),
      input,
      message.taskId,
      execution,
    );

    return {
      status: "success",
      message: outcome === "applied" ? "Teammate memory corrected" : "Memory is current",
      data: { outcome },
    };
  },
});
