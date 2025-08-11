import { describe, expect, it } from "vitest";
import { generateChatHistoryCSV, type ChatHistoryMessageRow } from "../csv";

function parseCsv(csv: string): string[][] {
  return csv
    .trim()
    .split(/\r?\n/)
    .map((line, idx) => {
      const normalized = idx === 0 && line.charCodeAt(0) === 0xfeff ? line.slice(1) : line;
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (ch === '"') {
          if (inQuotes && normalized[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          result.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current);
      return result;
    });
}

describe("generateChatHistoryCSV", () => {
  it("produces headers and no rows for empty input", () => {
    const csv = generateChatHistoryCSV([]);
    const rows = parseCsv(csv);
    expect(rows.length).toBe(1);
    expect(rows[0]).toEqual([
      "conversation_id",
      "conversation_title",
      "conversation_created_at",
      "message_id",
      "message_role",
      "message_content",
      "message_timestamp",
      "message_model",
    ]);
  });

  it("handles single conversation with multiple messages", () => {
    const input: ChatHistoryMessageRow[] = [
      {
        conversation_id: "c1",
        conversation_title: "Test convo",
        conversation_created_at: "2024-01-01T00:00:00Z",
        message_id: "m1",
        message_role: "user",
        message_content: "Hello",
        message_timestamp: 1,
        message_model: null,
      },
      {
        conversation_id: "c1",
        conversation_title: "Test convo",
        conversation_created_at: "2024-01-01T00:00:00Z",
        message_id: "m2",
        message_role: "assistant",
        message_content: "Hi",
        message_timestamp: 2,
        message_model: "gpt-test",
      },
    ];

    const csv = generateChatHistoryCSV(input);
    const rows = parseCsv(csv);
    expect(rows.length).toBe(3);
    expect(rows[1][0]).toBe("c1");
    expect(rows[2][3]).toBe("m2");
  });

  it("escapes commas, quotes and newlines", () => {
    const input: ChatHistoryMessageRow[] = [
      {
        conversation_id: "c1",
        conversation_title: "Title, with, commas",
        conversation_created_at: "2024-01-01",
        message_id: "m1",
        message_role: "user",
        message_content: "A line with, commas and a \"quote\" and a\nnewline",
        message_timestamp: "2024-01-01T00:00:00Z",
        message_model: "gpt-x",
      },
    ];

    const csv = generateChatHistoryCSV(input);
    const rows = parseCsv(csv);
    expect(rows[1][1]).toBe("Title, with, commas");
    expect(rows[1][5]).toBe("A line with, commas and a \"quote\" and a\nnewline");
  });
});