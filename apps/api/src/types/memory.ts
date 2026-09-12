import type { DelegationMemoryBinding } from "@ngriffin_uk/polychat-schemas";

export type MemoryScope =
  | { type: "personal" }
  | { type: "project"; projectId: string }
  | {
      type: "bound";
      scopeType: "personal" | "project";
      scopeId: string;
      documents: readonly DelegationMemoryBinding[];
      conversationId?: string;
      baseline?: { type: "personal" } | { type: "project"; projectId: string };
      teammateContext?: { id: string; memoryDocumentId: string };
    };
