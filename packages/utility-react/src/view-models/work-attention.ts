import type { WorkAttentionKind, WorkAttentionType } from "@ngriffin_uk/polychat-schemas";

export interface WorkAttentionFilters {
  kind?: WorkAttentionKind;
  workspaceId?: string;
  projectId?: string;
  ownerUserId?: number;
  type?: WorkAttentionType;
  from?: string;
  to?: string;
}
