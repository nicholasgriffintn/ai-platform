import type { IEnv, IUser } from "../types";
import type { Message } from "../types";
import { generateId } from "../utils/id";
import { getLogger } from "../utils/logger";
import { getAIResponse } from "./chat/responses";
import type { ConversationManager } from "./conversationManager";
import { Embedding } from "./embedding";

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
  private cache: Map<string, Array<{ text: string; score: number }>>;

  private constructor(env: IEnv, user?: IUser) {
    this.env = env;
    this.user = user;
    this.cache = new Map();
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
    });
    const namespace = `memory_user_${this.user?.id ?? "global"}`;

    // novelty filter: avoid storing duplicates
    // take the first vector as representative
    const rawVec = vectors[0].values as number[];
    const candidateVector = new Float64Array(rawVec);
    const existing = await embedding.getMatches(candidateVector, {
      topK: 5,
      scoreThreshold: 0,
      namespace,
    });
    const maxScore = (existing.matches || []).reduce(
      (m, v) => Math.max(m, v.score || 0),
      0,
    );
    if (maxScore >= 0.9) {
      return;
    }

    logger.debug("Inserting memory", { vectors, namespace });

    await embedding.insert(vectors, { namespace });
  }

  /**
   * Retrieve top‐k memories most relevant to a text query
   */
  public async retrieveMemories(
    query: string,
    opts?: { topK?: number; scoreThreshold?: number },
  ): Promise<Array<{ text: string; score: number }>> {
    const embedding = Embedding.getInstance(this.env, this.user);
    const topK = opts?.topK ?? 3;
    const scoreThreshold = opts?.scoreThreshold ?? 0.5;
    const namespace = `memory_user_${this.user?.id ?? "global"}`;

    // Embed the text query into a Float64Array vector
    const queryEmb = await embedding.getQuery(query);
    const rawNumbers = queryEmb.data[0] as number[];
    const vector = new Float64Array(rawNumbers);

    // Fetch nearest neighbors from the memory namespace
    const result = await embedding.getMatches(vector, {
      topK,
      scoreThreshold,
      namespace,
    });

    logger.debug("Retrieving memories", { result });

    // Filter by score and extract text
    const memories = (result.matches || [])
      .filter(
        (m) =>
          m.score >= scoreThreshold && typeof m.metadata?.text === "string",
      )
      .slice(0, topK)
      .map((m) => ({ text: m.metadata.text as string, score: m.score }));

    logger.debug("Retrieved memories", { memories });

    // Cache this query's results (optional)
    this.cache.set(query, memories);
    return memories;
  }

  /**
   * Process a user turn: classify the last user message, store key memories, and take periodic snapshots.
   */
  public async handleMemory(
    lastUser: string,
    messages: Message[],
    conversationManager: ConversationManager,
    completionId: string,
  ): Promise<MemoryEvent[]> {
    const events: MemoryEvent[] = [];
    // LLM‐driven memory classification
    try {
      if (lastUser.trim()) {
        const classifier = await getAIResponse({
          model: "mistral-large-latest",
          env: this.env,
          user: this.user,
          system_prompt:
            "You are a memory classifier. Decide if the following user message contains a stable fact, preference, goal, or important event worth storing as a long-term memory. Respond with JSON: { storeMemory: boolean, category: string, summary: string }",
          messages: [{ role: "user", content: lastUser }],
          response_format: { format: "json" },
        });
        let raw = classifier.response || "";
        raw = raw.trim();
        if (raw.startsWith("```")) {
          raw = raw.replace(/^```(?:json)?\\s*/, "").replace(/\\s*```$/, "");
        }
        const firstBrace = raw.indexOf("{");
        const lastBrace = raw.lastIndexOf("}");
        let jsonPart = "";
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonPart = raw.substring(firstBrace, lastBrace + 1);
        }

        let parsed: any;
        try {
          parsed = JSON.parse(jsonPart);
        } catch {
          parsed = null;
          logger.debug("Failed to parse classifier JSON", {
            raw: jsonPart,
            originalRaw: raw,
          });
        }
        if (parsed?.storeMemory) {
          const summaryText = parsed.summary || lastUser;
          const category = parsed.category || "general";
          logger.debug("Storing memory", { summaryText, category });
          await this.storeMemory(summaryText, {
            conversationId: completionId,
            timestamp: Date.now().toString(),
            category,
          });
          events.push({ type: "store", text: summaryText, category });
        }
      }
    } catch {
      // ignore classifier failures
    }

    // Periodic snapshot every 5 user turns
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
        const summaryResp = await getAIResponse({
          model: "mistral-large-latest",
          env: this.env,
          user: this.user,
          system_prompt:
            "Summarize the following conversation snippet into a single short memory capturing any important facts, preferences, goals, or events.",
          messages: [{ role: "user", content: snippet }],
          response_format: { format: "text" },
        });
        const text = summaryResp.response?.trim();
        if (text) {
          const category = "snapshot";
          logger.debug("Storing snapshot", { text });
          await this.storeMemory(text, {
            conversationId: completionId,
            timestamp: Date.now().toString(),
            category,
          });
          events.push({ type: "snapshot", text, category });
        }
      }
    } catch {
      // ignore snapshot failures
    }
    return events;
  }
}
