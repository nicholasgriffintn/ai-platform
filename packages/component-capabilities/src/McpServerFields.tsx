import { Button, FormInput } from "@ngriffin_uk/polychat-component-ui";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { Plus, Trash2 } from "lucide-react";

export interface McpServerFieldValue {
  id: string;
  label: string;
  url: string;
}

export interface McpServerFieldsProps {
  servers: McpServerFieldValue[];
  disabled?: boolean;
  minimumRows?: number;
  onChange: (servers: McpServerFieldValue[]) => void;
}

export function McpServerFields({
  servers,
  disabled = false,
  minimumRows = 0,
  onChange,
}: McpServerFieldsProps) {
  const update = (id: string, patch: Partial<McpServerFieldValue>) => {
    onChange(servers.map((server) => (server.id === id ? { ...server, ...patch } : server)));
  };

  return (
    <div className="space-y-3">
      {servers.map((server) => (
        <div
          key={server.id}
          className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_2fr_auto]"
        >
          <FormInput
            label="Label"
            value={server.label}
            disabled={disabled}
            onChange={(event) => update(server.id, { label: event.target.value })}
          />
          <FormInput
            label="Server URL"
            type="url"
            value={server.url}
            disabled={disabled}
            onChange={(event) => update(server.id, { url: event.target.value })}
          />
          <Button
            type="button"
            aria-label={`Remove ${server.label || "MCP server"}`}
            className="self-end"
            variant="outline"
            icon={<Trash2 className="h-4 w-4" />}
            disabled={disabled || servers.length <= minimumRows}
            onClick={() => onChange(servers.filter((item) => item.id !== server.id))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        icon={<Plus className="h-4 w-4" />}
        disabled={disabled}
        onClick={() => onChange([...servers, { id: generateId(), label: "", url: "" }])}
      >
        Add server
      </Button>
      <p className="text-xs text-muted-foreground">
        Use an HTTPS endpoint and do not put credentials in the URL.
      </p>
    </div>
  );
}
