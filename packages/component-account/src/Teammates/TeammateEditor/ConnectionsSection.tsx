import { McpServerFields } from "@ngriffin_uk/polychat-component-capabilities";

import { TeammateEditorSection } from "./TeammateEditorSection";
import type { TeammateEditorChange, TeammateEditorValue } from "./types";

export interface ConnectionsSectionProps {
  value: Pick<TeammateEditorValue, "servers">;
  disabled: boolean;
  onChange: TeammateEditorChange;
}

export function ConnectionsSection({ value, disabled, onChange }: ConnectionsSectionProps) {
  return (
    <TeammateEditorSection
      title="MCP servers"
      description="Remote MCP servers this teammate may use. Every operation requires approval."
    >
      <McpServerFields
        servers={value.servers}
        disabled={disabled}
        onChange={(servers) => onChange({ servers })}
      />
    </TeammateEditorSection>
  );
}
