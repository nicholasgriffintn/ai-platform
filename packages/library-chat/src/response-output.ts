import { itemText, type PlatformResponse, type StoredItem } from "@ngriffin_uk/polychat-schemas";

export interface AssistantOutput {
  id: string;
  text: string;
}

export function assistantOutputs(response: PlatformResponse): AssistantOutput[] {
  return (response.output ?? []).flatMap((item: StoredItem, index) => {
    if (item.type !== "message" || item.role !== "assistant") {
      return [];
    }

    const text = itemText(item).trim();

    return text ? [{ id: item.id ?? `${response.id}:${index}`, text }] : [];
  });
}

export function responseOutputText(response: PlatformResponse): string {
  return assistantOutputs(response)
    .map((output) => output.text)
    .join("\n\n");
}
