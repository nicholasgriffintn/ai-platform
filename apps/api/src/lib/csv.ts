import { Parser } from "json2csv";

export interface ChatHistoryMessageRow {
  conversation_id: string;
  conversation_title: string | null;
  conversation_created_at: string | null;
  message_id: string;
  message_role: string | null;
  message_content: string | null;
  message_timestamp: string | number | null;
  message_model: string | null;
}

export function generateChatHistoryCSV(rows: ChatHistoryMessageRow[]): string {
  if (!Array.isArray(rows)) {
    throw new Error("Invalid data: expected an array of rows");
  }

  const fields = [
    { label: "conversation_id", value: "conversation_id" },
    { label: "conversation_title", value: "conversation_title" },
    { label: "conversation_created_at", value: "conversation_created_at" },
    { label: "message_id", value: "message_id" },
    { label: "message_role", value: "message_role" },
    { label: "message_content", value: "message_content" },
    { label: "message_timestamp", value: "message_timestamp" },
    { label: "message_model", value: "message_model" },
  ];

  const parser = new Parser<ChatHistoryMessageRow>({
    fields,
    delimiter: ",",
    withBOM: true,
    transforms: [
      (item) => ({
        ...item,
        message_content:
          typeof item.message_content === "string"
            ? item.message_content
            : item.message_content == null
              ? null
              : String(item.message_content),
      }),
    ],
  });

  return parser.parse(rows);
}