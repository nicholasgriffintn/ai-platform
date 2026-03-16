import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { getEmbeddingProvider } from "~/lib/providers/capabilities/embedding/helpers";
import type { IEnv, IUser, IUserSettings, Message } from "~/types";
import { generateId } from "~/utils/id";
import { parseAIResponseJson } from "~/utils/json";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import type { ConversationManager } from "./conversationManager";
import { getAuxiliaryModel } from "./providers/models";
import { MemoryRepository } from "~/repositories/MemoryRepository";
import { getMemoryClassifierPrompt } from "~/lib/prompts/memoryClassifier";
import { getMemoryNormaliserPrompt } from "./prompts/memoryNormaliser";
import { getMemorySummariserPrompt } from "./prompts/memorySummariser";

const logger = getLogger({ prefix: "lib/memory" });

export interface MemoryEvent {
	type: "store" | "snapshot";
	text: string;
	category: string;
}

export class MemoryManager {
	private env: IEnv;
	private user?: IUser;

	constructor(env: IEnv, user?: IUser) {
		this.env = env;
		this.user = user;
	}

	public static getInstance(env: IEnv, user?: IUser): MemoryManager {
		return new MemoryManager(env, user);
	}

	/**
	 * Store a short summary or snippet into the memory vector store under a dedicated namespace
	 * @param metadata arbitrary string-based metadata (e.g. conversationId, timestamp, category)
	 * @param conversationId optional conversation ID to link this memory to
	 */
	public async storeMemory(
		text: string,
		metadata: Record<string, string>,
		conversationId?: string,
		userSettings?: IUserSettings,
	): Promise<string | null> {
		const embedding = getEmbeddingProvider(this.env, this.user, userSettings);
		const vectorId = generateId();

		const vectors = await embedding.generate("memory", text, vectorId, {
			...metadata,
			text,
			stored_at: Date.now().toString(),
		});

		const namespace = `memory_user_${this.user?.id ?? "global"}`;

		const rawVec = vectors[0].values as number[];
		const candidateVector = new Float64Array(rawVec);
		const existing = await embedding.getMatches(candidateVector, {
			topK: 5,
			scoreThreshold: 0,
			namespace,
			returnMetadata: "all",
		});

		const similarMemories = (existing.matches || [])
			.filter((m) => m.score >= 0.85 && m.metadata?.text)
			.map((m) => ({
				text: m.metadata.text as string,
				score: m.score,
				id: m.id,
			}));

		if (similarMemories.length > 0) {
			return null;
		}

		await embedding.insert(vectors, { namespace });

		if (this.user?.id) {
			try {
				const repository = new MemoryRepository(this.env);
				const memoryRecord = await repository.createMemory(
					this.user.id,
					text,
					metadata.category || "general",
					vectorId,
					conversationId,
					{
						...metadata,
						stored_at: Date.now().toString(),
					},
				);
				return memoryRecord?.id || null;
			} catch (error) {
				logger.warn("Failed to store memory in transactional database", {
					error,
				});
			}
		}

		return null;
	}

	/**
	 * Delete a memory from both vector and transactional databases
	 * @param memoryId - The memory ID from the transactional database
	 */
	public async deleteMemory(memoryId: string): Promise<boolean> {
		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to delete memories",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const repository = new MemoryRepository(this.env);
		const memory = await repository.getMemoryById(memoryId);

		if (!memory || memory.user_id !== this.user.id) {
			logger.warn("Memory not found or access denied", {
				memoryId,
				userId: this.user.id,
			});
			return false;
		}

		try {
			if (memory.vector_id) {
				const embedding = getEmbeddingProvider(this.env, this.user);
				await embedding.delete([memory.vector_id]);
			}

			await repository.deleteMemory(memoryId);

			await repository.removeMemoryFromGroups(memoryId);

			return true;
		} catch (error) {
			logger.error("Failed to delete memory", { error, memoryId });
			return false;
		}
	}

	/**
	 * Retrieve top‐k memories most relevant to a text query
	 * @param query - The text query to retrieve memories for
	 * @param opts - Optional parameters for the retrieval
	 * @returns An array of memories with their scores
	 */
	public async retrieveMemories(
		query: string,
		opts?: { topK?: number; scoreThreshold?: number },
	): Promise<Array<{ text: string; score: number }>> {
		const normalizedQuery = query.trim();

		if (normalizedQuery.length < 4) {
			return [];
		}

		const trivialWords = ["hi", "hey", "hello", "sup", "yo"];
		const words = normalizedQuery.toLowerCase().split(/\s+/);

		if (words.length <= 2 && words.every((w) => trivialWords.includes(w))) {
			return [];
		}

		const embedding = getEmbeddingProvider(this.env, this.user);
		const topK = opts?.topK ?? 3;
		const scoreThreshold = opts?.scoreThreshold ?? 0.3;
		const namespace = `memory_user_${this.user?.id ?? "global"}`;

		const queryEmb = await embedding.getQuery(query);
		const rawNumbers = queryEmb.data[0] as number[];
		const vector = new Float64Array(rawNumbers);

		const result = await embedding.getMatches(vector, {
			topK: Math.max(topK * 2, 10),
			scoreThreshold,
			namespace,
			returnMetadata: "all",
		});

		if (!result.matches) {
			return [];
		}

		const memories = (result.matches || [])
			.filter(
				(m) =>
					m.score >= scoreThreshold && typeof m.metadata?.text === "string",
			)
			.slice(0, topK)
			.map((m) => ({ text: m.metadata.text as string, score: m.score }));

		return memories;
	}

	/**
	 * Process a user turn: classify the last user message, store key memories, and take periodic snapshots.
	 * @param lastUser - The last user message
	 * @param messages - The messages in the conversation
	 * @param conversationManager - The conversation manager
	 * @param completionId - The ID of the completion
	 * @param userSettings - The user settings
	 * @returns An array of memory events
	 */
	public async handleMemory(
		lastUser: string,
		messages: Message[],
		conversationManager: ConversationManager,
		completionId: string,
		userSettings: IUserSettings,
	): Promise<MemoryEvent[]> {
		const events: MemoryEvent[] = [];

		if (userSettings?.memories_save_enabled) {
			try {
				if (lastUser.trim()) {
					const { model: modelToUse, provider: providerToUse } =
						await getAuxiliaryModel(this.env, this.user);
					const provider = getChatProvider(providerToUse, {
						env: this.env,
						user: this.user,
					});
					const classifier = await provider.getResponse(
						{
							model: modelToUse,
							env: this.env,
							user: this.user,
							messages: [
								{
									role: "system",
									content: getMemoryClassifierPrompt(),
								},
								{ role: "user", content: lastUser },
							],
							response_format: { format: "json" },
						},
						this.user?.id,
					);

					const parsed = parseAIResponseJson<{
						storeMemory: boolean;
						category: string;
						summary: string;
					}>(classifier.response);

					if (parsed.data?.storeMemory) {
						const summaryText = parsed.data.summary || lastUser;
						const category = parsed.data.category || "general";

						await this.storeMemory(
							summaryText,
							{
								conversationId: completionId,
								timestamp: Date.now().toString(),
								category,
								isNormalized: "false",
							},
							undefined,
							userSettings,
						);

						if (["fact", "schedule", "preference"].includes(category)) {
							try {
								const normalizer = await provider.getResponse(
									{
										model: modelToUse,
										env: this.env,
										user: this.user,
										messages: [
											{
												role: "system",
												content: getMemoryNormaliserPrompt(),
											},
											{ role: "user", content: summaryText },
										],
										response_format: { format: "json" },
									},
									this.user?.id,
								);

								try {
									let normalized: string[] = [];
									const response = normalizer.response?.trim() || "";

									const parsedResponse = parseAIResponseJson<
										string[] | { text: string[] }
									>(response);

									if (parsedResponse) {
										if (Array.isArray(parsedResponse.data)) {
											normalized = parsedResponse.data;
										} else if (
											parsedResponse.data?.text &&
											Array.isArray(parsedResponse.data.text)
										) {
											normalized = parsedResponse.data.text;
										}
									}

									normalized = normalized
										.filter(
											(text) =>
												typeof text === "string" && text.trim().length > 0,
										)
										.map((text) => text.trim())
										.filter(
											(text) =>
												!text.includes("###") &&
												!text.includes("**") &&
												text.length < 200,
										);

									for (const altText of normalized) {
										await this.storeMemory(
											altText,
											{
												conversationId: completionId,
												timestamp: Date.now().toString(),
												category,
												isNormalized: "true",
												originalText: summaryText,
											},
											undefined,
											userSettings,
										);
									}
								} catch (e) {
									logger.error("Failed to process normalized memory", {
										error: e,
										response: normalizer.response,
									});
								}
							} catch (e) {
								logger.error("Failed to normalize memory", { error: e });
							}
						}

						events.push({ type: "store", text: summaryText, category });
					}
				}
			} catch (e) {
				logger.error("Memory classification failed", { error: e });
			}
		}

		if (userSettings?.memories_chat_history_enabled) {
			try {
				const userCount = messages.filter((m) => m.role === "user").length;
				if (userCount > 0 && userCount % 5 === 0) {
					const recent = await conversationManager.get(
						completionId,
						undefined,
						10,
					);
					const snippet = recent
						.map(
							(m) =>
								`${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`,
						)
						.join("\n");

					const { model: modelToUse, provider: providerToUse } =
						await getAuxiliaryModel(this.env, this.user);
					const provider = getChatProvider(providerToUse, {
						env: this.env,
						user: this.user,
					});

					const summaryResp = await provider.getResponse(
						{
							model: modelToUse,
							env: this.env,
							user: this.user,
							messages: [
								{
									role: "system",
									content: getMemorySummariserPrompt(),
								},
								{ role: "user", content: snippet },
							],
						},
						this.user?.id,
					);
					const text = summaryResp.response?.trim();
					if (text) {
						const category = "snapshot";

						try {
							await this.storeMemory(
								text,
								{
									conversationId: completionId,
									timestamp: Date.now().toString(),
									category,
								},
								undefined,
								userSettings,
							);
							events.push({ type: "snapshot", text, category });
						} catch (e) {
							logger.error("Failed to store snapshot", { error: e });
						}
					}
				}
			} catch (e) {
				logger.error("Snapshot generation failed", { error: e });
			}
		}

		return events;
	}
}
