import type { IEnv } from "~/types";
import type { TaskMessage } from "../TaskService";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import { MemoryRepository } from "~/repositories/MemoryRepository";
import { MemorySynthesisRepository } from "~/repositories/MemorySynthesisRepository";
import { getLogger } from "~/utils/logger";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getAuxiliaryModel } from "~/lib/models";

const logger = getLogger({ prefix: "services/tasks/memory-synthesis" });

interface CategorizedMemories {
	[category: string]: Array<{ id: string; text: string; category: string }>;
}

export class MemorySynthesisHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		try {
			const { namespace = "global" } = message.task_data;

			if (!message.user_id) {
				return {
					status: "error",
					message: "user_id is required for memory synthesis",
				};
			}

			const memoryRepository = new MemoryRepository(env);
			const memorySynthesisRepository = new MemorySynthesisRepository(env);

			const memories = await memoryRepository.getMemoriesByUserId(
				message.user_id,
			);

			const activeMemories = memories.filter(
				(m) =>
					(m.namespace === namespace || !m.namespace) &&
					(m.is_active === true ||
						(m.is_active as any) === 1 ||
						m.is_active === null),
			);

			if (activeMemories.length === 0) {
				return {
					status: "skipped",
					message: "No active memories to synthesize",
				};
			}

			const existingSynthesis =
				await memorySynthesisRepository.getActiveSynthesis(
					message.user_id,
					namespace,
				);

			const categorized = this.categorizeMemories(activeMemories);

			const synthesis = await this.generateSynthesis(
				categorized,
				existingSynthesis,
				env,
			);

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
				await memorySynthesisRepository.supersedeSynthesis(
					existingSynthesis.id,
					synthesisRecord.id,
				);
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
		} catch (error) {
			logger.error("Memory synthesis error:", error);
			return {
				status: "error",
				message: (error as Error).message,
			};
		}
	}

	private categorizeMemories(
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

	private async generateSynthesis(
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
			const { model: modelToUse, provider: providerToUse } =
				await getAuxiliaryModel(env);

			const provider = getChatProvider(providerToUse, { env, user: undefined });

			const response = await provider.getResponse({
				env,
				model: modelToUse,
				messages: [{ role: "user", content: prompt }],
				max_tokens: 2000,
			});

			return response.response;
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
}
