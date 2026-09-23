import { isRecord, safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import type { ZodType } from "zod/v4";

import { getErrorMessage } from "./errors.js";

export { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

export function parseJsonRecord(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? safeParseJson<unknown>(value) : value;

  return isRecord(parsed) ? parsed : {};
}

export function parseJsonStringArray(value: string | null | undefined): string[] | undefined {
  const parsed = value ? safeParseJson<unknown>(value) : undefined;

  return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : undefined;
}

export function parseJsonArrayColumn<T>(value: unknown, itemSchema: ZodType<T>): T[] | null {
  const parsed = typeof value === "string" ? safeParseJson<unknown>(value) : value;

  if (!Array.isArray(parsed)) {
    return null;
  }

  return parsed.flatMap((entry) => {
    const result = itemSchema.safeParse(entry);

    return result.success ? [result.data] : [];
  });
}

export interface ParseResult<T> {
  data: T | null;
  error: string | null;
  partialData?: Record<string, unknown> | null;
}

export function parseAIResponseJson<T = any>(response: string | null | undefined): ParseResult<T> {
  if (!response) {
    return { data: null, error: "Empty response" };
  }

  let cleanedResponse = response.trim();

  if (cleanedResponse.startsWith("```")) {
    const blockEnd = cleanedResponse.lastIndexOf("```");

    if (blockEnd > 3) {
      const contentStart = cleanedResponse.indexOf("\n") + 1;

      cleanedResponse = cleanedResponse.substring(contentStart, blockEnd).trim();
    }
  }

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
    const parsedData = JSON.parse(cleanedResponse) as T;

    return {
      data: parsedData,
      error: null,
    };
  } catch (e) {
    try {
      const fixedJson = cleanedResponse
        .replace(/,\s*}/g, "}") // Remove trailing commas
        .replace(/,\s*\]/g, "]") // Remove trailing commas in arrays
        .replace(/'/g, '"'); // Replace single quotes with double quotes

      const fixedData = JSON.parse(fixedJson);

      return {
        data: fixedData as T,
        error: null,
      };
    } catch {
      const partialData = {
        preview: cleanedResponse.substring(0, 100),
        length: cleanedResponse.length,
      };

      return {
        data: null,
        error: getErrorMessage(e),
        partialData,
      };
    }
  }
}

export function compactJsonWhitespace(content: string): string {
  if (content.length > 1_000_000 || !/^[\t\r\n ]*[[{]/.test(content)) {
    return content;
  }

  try {
    JSON.parse(content);
  } catch {
    return content;
  }

  const characters: string[] = [];
  let inString = false;
  let escaped = false;

  for (const character of content) {
    if (inString) {
      characters.push(character);
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
    } else if (character === '"') {
      inString = true;
      characters.push(character);
    } else if (
      character !== " " &&
      character !== "\t" &&
      character !== "\n" &&
      character !== "\r"
    ) {
      characters.push(character);
    }
  }

  return characters.join("");
}
