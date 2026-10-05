import { McpServerFields } from "@ngriffin_uk/polychat-component-capabilities";
import type { NativeMcpServer } from "@ngriffin_uk/polychat-schemas";

import { TeammateEditorSection } from "./TeammateEditorSection";
import type { TeammateEditorChange, TeammateEditorValue } from "./types";

export interface ConnectionsSectionProps {
  value: Pick<TeammateEditorValue, "servers">;
  disabled: boolean;
  availableServers?: NativeMcpServer[];
  onChange: TeammateEditorChange;
}

export function ConnectionsSection({
  value,
  disabled,
  onChange,
  availableServers,
}: ConnectionsSectionProps) {
  return (
    <TeammateEditorSection
      title="MCP servers"
      description="Registered tools this teammate may use. Writes require approval of the exact action."
    >
      <McpServerFields
        servers={value.servers}
        availableServers={availableServers}
        disabled={disabled}
        onChange={(servers) => onChange({ servers })}
      />
    </TeammateEditorSection>
  );
}
