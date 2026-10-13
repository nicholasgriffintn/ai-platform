import { parseAIResponseJson } from "@ngriffin_uk/polychat-utility-server/json";

const FENCED_BLOCK = /```([a-z]*)\s*\n([\s\S]*?)```/gi;

export const JSON_ANSWER_INSTRUCTION =
  "Think it through privately, then reply with the JSON object only. No prose before or after it.";

export function parseJsonAnswer(output: string): unknown {
  return parseAIResponseJson<unknown>(output).data;
}

export function extractFencedBlock(output: string, languages: readonly string[]): string | null {
  const blocks = [...output.matchAll(FENCED_BLOCK)];
  const preferred = blocks.find((block) => languages.includes((block[1] ?? "").toLowerCase()));
  const chosen = preferred ?? blocks.at(-1);

  return chosen?.[2]?.trim() ?? null;
}
