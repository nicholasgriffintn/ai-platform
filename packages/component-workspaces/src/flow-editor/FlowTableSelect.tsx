import { FormSelect } from "@ngriffin_uk/polychat-component-ui";

import type { FlowEditorResources } from "./types";

export function FlowTableSelect({
  value,
  resources,
  onChange,
}: {
  value: string;
  resources: FlowEditorResources;
  onChange: (tableId: string) => void;
}) {
  return (
    <FormSelect
      label="Project table"
      value={value}
      options={[
        { value: "", label: "Choose a shared table…" },
        ...resources.recordTables.map((table) => ({ value: table.id, label: table.title })),
      ]}
      onValueChange={(id) => {
        resources.onSelectTable(id);
        onChange(id);
      }}
    />
  );
}
