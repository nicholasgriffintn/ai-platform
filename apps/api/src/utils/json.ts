import { getLogger } from "./logger";

const logger = getLogger();

export interface ParseResult<T> {
  data: T | null;
  error: string | null;
  partialData?: Record<string, unknown> | null;
}

/**
 * Safely parses JSON from AI/LLM responses, handling edge cases like markdown formatting
 * @param response Raw response text from an AI/LLM model
 * @returns Parsed JSON object or null if parsing fails
 */
export function parseAIResponseJson<T = any>(
  response: string | null | undefined,
): ParseResult<T> {
  if (!response) {
    return { data: null, error: "Empty response" };
  }

  let cleanedResponse = response.trim();

  // Remove markdown code blocks if present
  if (cleanedResponse.startsWith("```")) {
    // Extract content between code block markers
    const blockEnd = cleanedResponse.lastIndexOf("```");
    if (blockEnd > 3) {
      // Skip the language identifier if present (e.g., ```json)
      const contentStart = cleanedResponse.indexOf("\n") + 1;
      cleanedResponse = cleanedResponse
        .substring(contentStart, blockEnd)
        .trim();
    }
  }

  // Try to find JSON object or array within the cleaned text
  const firstBrace = cleanedResponse.indexOf("{");
  const firstBracket = cleanedResponse.indexOf("[");

  let jsonStart = -1;
  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    jsonStart = firstBrace;
    const lastBrace = cleanedResponse.lastIndexOf("}");
    if (lastBrace > jsonStart) {
      cleanedResponse = cleanedResponse.substring(jsonStart, lastBrace + 1);
    }
  } else if (firstBracket >= 0) {
    jsonStart = firstBracket;
    const lastBracket = cleanedResponse.lastIndexOf("]");
    if (lastBracket > jsonStart) {
      cleanedResponse = cleanedResponse.substring(jsonStart, lastBracket + 1);
    }
  }

  try {
    let parsedData;
    try {
      parsedData = JSON.parse(cleanedResponse) as T;
    } catch (e) {
      logger.error("Failed to parse JSON", { error: e });
      parsedData = null;
    }
    return {
      data: parsedData,
      error: null,
    };
  } catch (e) {
    let partialData = null;
    try {
      const fixedJson = cleanedResponse
        .replace(/,\s*}/g, "}") // Remove trailing commas
        .replace(/,\s*\]/g, "]") // Remove trailing commas in arrays
        .replace(/'/g, '"'); // Replace single quotes with double quotes

      let parsedData;
      try {
        parsedData = JSON.parse(fixedJson);
      } catch (e) {
        logger.error("Failed to parse JSON", { error: e });
        parsedData = null;
      }
      partialData = parsedData;
    } catch {
      partialData = {
        preview: cleanedResponse.substring(0, 100),
        length: cleanedResponse.length,
      };
    }

    return {
      data: null,
      error: e instanceof Error ? e.message : String(e),
      partialData,
    };
  }
}
