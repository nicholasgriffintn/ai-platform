import { AIProviderFactory } from "~/lib/providers/factory";
import type { IEnv, IUser, IUserSettings, Message } from "~/types";
import { generateId } from "~/utils/id";
import { parseAIResponseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import type { ConversationManager } from "./conversationManager";
import { Embedding } from "./embedding";
import { getAuxiliaryModel } from "./models";

const logger = getLogger({ prefix: "MEMORY" });

export interface MemoryEvent {
  type: "store" | "snapshot";
  text: string;
  category: string;
}

export class MemoryManager {
  private static instance: MemoryManager;
  private env: IEnv;
  private user?: IUser;

  private constructor(env: IEnv, user?: IUser) {
    this.env = env;
    this.user = user;
  }

  public static getInstance(env: IEnv, user?: IUser): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager(env, user);
    }
    return MemoryManager.instance;
  }

  /**
   * Store a short summary or snippet into the memory vector store under a dedicated namespace
   * @param metadata arbitrary string-based metadata (e.g. conversationId, timestamp, category)
   */
  public async storeMemory(
    text: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    const embedding = Embedding.getInstance(this.env, this.user);
    const id = generateId();

    logger.debug("Storing memory", { text, metadata, id });

    const vectors = await embedding.generate("memory", text, id, {
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
      logger.debug("Found similar memories, skipping insertion", {
        similarMemories,
      });
      return;
    }

    logger.debug("Inserting memory", {
      vectorCount: vectors.length,
      namespace,
      category: metadata.category,
    });

    await embedding.insert(vectors, { namespace });
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
    const embedding = Embedding.getInstance(this.env, this.user);
    const topK = opts?.topK ?? 3;
    const scoreThreshold = opts?.scoreThreshold ?? 0.3;
    const namespace = `memory_user_${this.user?.id ?? "global"}`;

    logger.debug("Memory query", { query });

    const queryEmb = await embedding.getQuery(query);
    const rawNumbers = queryEmb.data[0] as number[];
    const vector = new Float64Array(rawNumbers);

    const result = await embedding.getMatches(vector, {
      topK: Math.max(topK * 2, 10),
      scoreThreshold,
      namespace,
      returnMetadata: "all",
    });

    logger.debug("Raw memory matches", {
      matches: result.matches?.length || 0,
    });

    if (!result.matches) {
      logger.debug("Insufficient matches.");

      return [];
    }

    const memories = (result.matches || [])
      .filter(
        (m) =>
          m.score >= scoreThreshold && typeof m.metadata?.text === "string",
      )
      .slice(0, topK)
      .map((m) => ({ text: m.metadata.text as string, score: m.score }));

    logger.debug("Retrieved memories", {
      count: memories.length,
      topScore: memories[0]?.score,
    });

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
          const provider = AIProviderFactory.getProvider(providerToUse);
          const classifier = await provider.getResponse(
            {
              model: modelToUse,
              env: this.env,
              user: this.user,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a memory classifier for an AI assistant. Analyze the following user message and determine if it contains information worth remembering as a long-term memory. This could include facts about the user, preferences, important events, appointments, goals, or other significant information. For memories that should be stored, provide a clear, concise summary that will be easily retrievable when the user asks related questions later. Respond with JSON: { storeMemory: boolean, category: string, summary: string }. Use specific categories when possible (e.g., 'preference', 'schedule', 'goal', 'fact', 'opinion').",
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

            logger.debug("Storing classified memory", {
              summaryText,
              category,
            });

            await this.storeMemory(summaryText, {
              conversationId: completionId,
              timestamp: Date.now().toString(),
              category,
              isNormalized: "false",
            });

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
                        content:
                          "You are a memory normalizer. Transform the following user information into 2-3 concise, alternative phrasings that might match how users would later ask about this information. Each alternative should be a plain, natural language sentence without any formatting, headers, or structured data. Respond with a JSON array of strings, where each string is a complete alternative phrasing. Focus on creating variations that would help with semantic search matching.",
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
                    await this.storeMemory(altText, {
                      conversationId: completionId,
                      timestamp: Date.now().toString(),
                      category,
                      isNormalized: "true",
                      originalText: summaryText,
                    });
                    logger.debug("Stored alternative memory phrasing", {
                      altText,
                    });
                  }
                } catch (e) {
                  logger.debug("Failed to process normalized memory", {
                    error: e,
                    response: normalizer.response,
                  });
                }
              } catch (e) {
                logger.debug("Failed to normalize memory", { error: e });
              }
            }

            events.push({ type: "store", text: summaryText, category });
          }
        }
      } catch (e) {
        logger.debug("Memory classification failed", { error: e });
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
          logger.debug("Summarizing conversation", { snippet });
          const { model: modelToUse, provider: providerToUse } =
            await getAuxiliaryModel(this.env, this.user);
          const provider = AIProviderFactory.getProvider(providerToUse);
          const summaryResp = await provider.getResponse(
            {
              model: modelToUse,
              env: this.env,
              user: this.user,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a memory summarizer. Summarize the following conversation snippet into a single short memory capturing any important facts, preferences, goals, or events.",
                },
                { role: "user", content: snippet },
              ],
            },
            this.user?.id,
          );
          const text = summaryResp.response?.trim();
          if (text) {
            const category = "snapshot";
            logger.debug("Storing snapshot", { text });
            try {
              await this.storeMemory(text, {
                conversationId: completionId,
                timestamp: Date.now().toString(),
                category,
              });
              events.push({ type: "snapshot", text, category });
            } catch (e) {
              logger.debug("Failed to store snapshot", { error: e });
            }
          }
        }
      } catch (e) {
        logger.debug("Snapshot generation failed", { error: e });
      }
    }

    return events;
  }
}
