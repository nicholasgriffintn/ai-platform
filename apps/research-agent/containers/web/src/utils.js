import URL from "url-parse";
import { config } from "./config.js";

export function validateUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "unknown";
  }
}

export function generateExcerpt(text, maxLength = null) {
  if (maxLength === null) {
    maxLength = config.maxExcerptLength;
  }

  if (!text) return "";

  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;

  const sentences = cleaned.split(/[.!?]+/);
  let excerpt = "";

  for (const sentence of sentences) {
    if (excerpt.length + sentence.length + 1 <= maxLength) {
      excerpt += (excerpt ? ". " : "") + sentence.trim();
    } else {
      break;
    }
  }

  if (!excerpt) {
    excerpt = cleaned.substring(0, maxLength - 3) + "...";
  }

  return excerpt;
}

export function measureTime(startTime) {
  return Date.now() - startTime;
}

export function createSuccessResponse(data, processingTime) {
  return {
    success: true,
    data,
    processing_time_ms: processingTime,
  };
}

export function createErrorResponse(error, processingTime) {
  return {
    success: false,
    error: `${error.message}`,
    processing_time_ms: processingTime,
  };
}
