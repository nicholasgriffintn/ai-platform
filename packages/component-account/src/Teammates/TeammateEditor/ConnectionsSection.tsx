import { McpServerFields } from "@ngriffin_uk/polychat-component-capabilities";
import type { McpConnection } from "@ngriffin_uk/polychat-schemas";

import { TeammateEditorSection } from "./TeammateEditorSection";
import type { TeammateEditorChange, TeammateEditorValue } from "./types";

export interface ConnectionsSectionProps {
  connections?: McpConnection[];
  value: Pick<TeammateEditorValue, "servers">;
  disabled: boolean;
  onChange: TeammateEditorChange;
}

export function ConnectionsSection({
  value,
  disabled,
  onChange,
  connections,
}: ConnectionsSectionProps) {
  return (
    <TeammateEditorSection
      title="MCP servers"
      description="Remote MCP servers this teammate may use. Every operation requires approval."
    >
      <McpServerFields
        connections={connections}
        servers={value.servers}
        disabled={disabled}
        onChange={(servers) => onChange({ servers })}
      />
    </TeammateEditorSection>
  );
}
