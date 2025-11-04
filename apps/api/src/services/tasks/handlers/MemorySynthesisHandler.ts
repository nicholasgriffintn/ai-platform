import type { IEnv } from "~/types";
import type { TaskMessage } from "../TaskService";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import { MemoryRepository } from "~/repositories/MemoryRepository";
import { MemorySynthesisRepository } from "~/repositories/MemorySynthesisRepository";
import { getLogger } from "~/utils/logger";
import { AIProviderFactory } from "~/lib/providers/factory";
import { getAuxiliaryModel } from "~/lib/models";

const logger = getLogger({ prefix: "services/tasks/memory-synthesis" });

interface CategorizedMemories {
	[category: string]: Array<{ id: string; text: string; category: string }>;
}

/**
 * Handler for memory synthesis tasks
 */
export class MemorySynthesisHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		try {
			const { user_id, namespace = "global" } = message.task_data;

			if (!user_id) {
				return {
					status: "error",
					message: "user_id is required for memory synthesis",
				};
			}

			const memoryRepository = new MemoryRepository(env);
			const memorySynthesisRepository = new MemorySynthesisRepository(env);

			// 1. Fetch all active memories for user
			const memories = await memoryRepository.getMemoriesByUserId(user_id);

			// Filter by namespace and active status
			// Note: SQLite stores booleans as integers (0/1), so we need to check both
			const activeMemories = memories.filter(
				(m) =>
					(m.namespace === namespace || !m.namespace) &&
					(m.is_active === true || (m.is_active as any) === 1 || m.is_active === null),
			);

			if (activeMemories.length === 0) {
				return {
					status: "skipped",
					message: "No active memories to synthesize",
				};
			}

			// 2. Fetch existing synthesis for comparison
			const existingSynthesis =
				await memorySynthesisRepository.getActiveSynthesis(user_id, namespace);

			// 3. Group memories by category
			const categorized = this.categorizeMemories(activeMemories);

			// 4. Generate synthesis using AI
			const synthesis = await this.generateSynthesis(
				categorized,
				existingSynthesis,
				env,
			);

			// 5. Store new synthesis
			const synthesisRecord =
				await memorySynthesisRepository.createSynthesis({
					user_id,
					namespace,
					synthesis_text: synthesis,
					memory_ids: activeMemories.map((m) => m.id),
					memory_count: activeMemories.length,
					synthesis_version: (existingSynthesis?.synthesis_version ?? 0) + 1,
				});

			if (!synthesisRecord) {
				throw new Error("Failed to create synthesis record");
			}

			// 6. Mark old synthesis as superseded
			if (existingSynthesis) {
				await memorySynthesisRepository.supersedeSynthesis(
					existingSynthesis.id,
					synthesisRecord.id,
				);
			}

			logger.info(
				`Memory synthesis completed for user ${user_id}, synthesized ${activeMemories.length} memories`,
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

	/**
	 * Categorize memories by their category field
	 */
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

	/**
	 * Generate synthesis using AI
	 */
	private async generateSynthesis(
		categorized: CategorizedMemories,
		existing: any,
		env: IEnv,
	): Promise<string> {
		const provider = AIProviderFactory.getProvider("anthropic");

		// Build the prompt
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

Create a clear, factual synthesis that:
1. Groups related information
2. Resolves any conflicts (prefer recent information)
3. Removes redundancies
4. Maintains specific dates and facts
5. Is easy to scan and reference

Format as a structured document with clear sections.`;

		try {
			const auxiliaryModel = await getAuxiliaryModel(env);

			const response = await provider.getResponse({
				env,
				model: auxiliaryModel.model,
				messages: [{ role: "user", content: prompt }],
				max_tokens: 2000,
			});

			return response.response;
		} catch (error) {
			logger.error("Failed to generate synthesis with AI:", error);
			// Fallback to simple concatenation if AI fails
			return Object.entries(categorized)
				.map(
					([category, mems]) =>
						`## ${category.toUpperCase()}\n${mems.map((m) => `- ${m.text}`).join("\n")}`,
				)
				.join("\n\n");
		}
	}
}
