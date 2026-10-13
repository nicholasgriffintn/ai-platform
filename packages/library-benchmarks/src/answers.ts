import { parseAIResponseJson } from "@ngriffin_uk/polychat-utility-server/json";

const FENCE = "```";

interface FencedBlock {
  language: string;
  body: string;
}

export const JSON_ANSWER_INSTRUCTION =
  "Think it through privately, then reply with the JSON object only. No prose before or after it.";

export function parseJsonAnswer(output: string): unknown {
  return parseAIResponseJson<unknown>(output).data;
}

function readFencedBlocks(output: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  let cursor = 0;

  for (;;) {
    const open = output.indexOf(FENCE, cursor);
    const lineEnd = open === -1 ? -1 : output.indexOf("\n", open + FENCE.length);
    const close = lineEnd === -1 ? -1 : output.indexOf(FENCE, lineEnd + 1);

    if (close === -1) {
      return blocks;
    }

    blocks.push({
      language: output
        .slice(open + FENCE.length, lineEnd)
        .trim()
        .toLowerCase(),
      body: output.slice(lineEnd + 1, close).trim(),
    });
    cursor = close + FENCE.length;
  }
}

export function extractFencedBlock(output: string, languages: readonly string[]): string | null {
  const blocks = readFencedBlocks(output);
  const chosen = blocks.find((block) => languages.includes(block.language)) ?? blocks.at(-1);

  return chosen?.body ?? null;
}
