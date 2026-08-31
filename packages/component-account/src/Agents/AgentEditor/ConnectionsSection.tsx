import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { Plus, Trash2 } from "lucide-react";

import { AgentEditorSection } from "./AgentEditorSection";
import type { AgentEditorChange, AgentEditorValue } from "./types";

export interface ConnectionsSectionProps {
  value: Pick<AgentEditorValue, "servers">;
  disabled: boolean;
  onChange: AgentEditorChange;
}

export function ConnectionsSection({ value, disabled, onChange }: ConnectionsSectionProps) {
  return (
    <AgentEditorSection
      title="Connections"
      description="MCP servers this agent reaches for beyond the built-in capabilities."
    >
      {value.servers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No MCP servers connected.</p>
      ) : (
        value.servers.map((server, index) => (
          <div key={server.id} className="flex items-end gap-3 rounded-lg border p-4">
            <FormInput
              label="URL"
              type="url"
              value={server.url}
              disabled={disabled}
              required
              className="flex-1"
              placeholder="https://mcp.example.com/sse"
              onChange={(event) =>
                onChange({
                  servers: value.servers.map((entry) =>
                    entry.id === server.id ? { ...entry, url: event.target.value } : entry,
                  ),
                })
              }
            />
            <FormSelect
              label="Type"
              value={server.type}
              disabled={disabled}
              options={[
                { value: "sse", label: "SSE" },
                { value: "stdio", label: "Stdio" },
              ]}
              onChange={(event) =>
                onChange({
                  servers: value.servers.map((entry) =>
                    entry.id === server.id
                      ? { ...entry, type: event.target.value === "stdio" ? "stdio" : "sse" }
                      : entry,
                  ),
                })
              }
            />
            <Button
              variant="destructive"
              size="icon"
              type="button"
              disabled={disabled}
              aria-label={`Remove server ${index + 1}`}
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() =>
                onChange({ servers: value.servers.filter((entry) => entry.id !== server.id) })
              }
            />
          </div>
        ))
      )}

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        icon={<Plus className="h-4 w-4" />}
        onClick={() =>
          onChange({ servers: [...value.servers, { id: generateId(), url: "", type: "sse" }] })
        }
      >
        Add server
      </Button>
    </AgentEditorSection>
  );
}
