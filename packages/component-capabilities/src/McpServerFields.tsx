import type { NativeMcpServer } from "@ngriffin_uk/polychat-schemas";

const emptyServers: NativeMcpServer[] = [];

export interface McpServerFieldValue {
  id: string;
}
export interface McpServerFieldsProps {
  servers: McpServerFieldValue[];
  availableServers?: NativeMcpServer[];
  disabled?: boolean;
  onChange: (servers: McpServerFieldValue[]) => void;
}

export function McpServerFields({
  servers,
  availableServers = emptyServers,
  disabled = false,
  onChange,
}: McpServerFieldsProps) {
  return (
    <div className="space-y-3">
      {availableServers.map((server) => (
        <label key={server.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={disabled || !server.enabled}
            checked={servers.some((selected) => selected.id === server.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...servers, { id: server.id }]
                  : servers.filter((selected) => selected.id !== server.id),
              )
            }
          />
          {server.label}
          {server.enabled ? "" : " (disabled)"}
        </label>
      ))}
      {servers
        .filter((selected) => !availableServers.some((server) => server.id === selected.id))
        .map((selected) => (
          <label key={selected.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked
              disabled={disabled}
              onChange={() => onChange(servers.filter((server) => server.id !== selected.id))}
            />
            Unavailable server
          </label>
        ))}
      <p className="text-xs text-muted-foreground">
        Register and connect servers in your account’s Connected tools settings. Each person uses
        their own credentials.
      </p>
    </div>
  );
}
