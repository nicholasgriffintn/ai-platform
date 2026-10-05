import type { NativeRecordColumn } from "@ngriffin_uk/polychat-schemas";

export interface FlowRecordTableOption {
  id: string;
  title: string;
}

export interface FlowRecordTableDefinition extends FlowRecordTableOption {
  columns: NativeRecordColumn[];
}

export interface FlowEditorResources {
  teammates: { id: string; name: string }[];
  skills: { id: string; name: string }[];
  members: { userId: number; name: string | null }[];
  recordTables: FlowRecordTableOption[];
  recordDefinitions: FlowRecordTableDefinition[];
  onSelectTable: (tableId: string) => void;
}
