import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  ModelToolConfiguration,
  ModelToolDefinition,
  McpConnection,
} from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

import { McpServerFields } from "./McpServerFields";
import { useToolConfigurationForm } from "./useToolConfigurationForm";

interface ToolConfigurationDialogProps {
  configuration?: Record<string, unknown>;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (configuration: ModelToolConfiguration) => Promise<void>;
  tool: ModelToolDefinition | null;
  mcpConnections?: McpConnection[];
  mcpConnectionManager?: ReactNode;
}

export function ToolConfigurationDialog({
  configuration: storedConfiguration,
  isLoading,
  onClose,
  onSubmit,
  tool,
  mcpConnections,
  mcpConnectionManager,
}: ToolConfigurationDialogProps) {
  const { vectorStoreIds, setVectorStoreIds, servers, setServers, error, submit } =
    useToolConfigurationForm(tool, storedConfiguration, onSubmit);

  return (
    <Dialog open={Boolean(tool)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {tool?.label}</DialogTitle>
          <DialogDescription>{tool?.description}</DialogDescription>
        </DialogHeader>

        {tool?.configurationKind === "file_search" ? (
          <div className="space-y-2">
            <label htmlFor="project-vector-store-ids" className="text-sm font-medium">
              Vector store IDs
            </label>
            <Textarea
              id="project-vector-store-ids"
              value={vectorStoreIds}
              onChange={(event) => setVectorStoreIds(event.target.value)}
              placeholder="vs_abc123"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">Enter one ID per line.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <McpServerFields
              servers={servers}
              minimumRows={1}
              onChange={setServers}
              connections={mcpConnections}
            />
            {mcpConnectionManager}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-failure">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isLoading} onClick={() => void submit()}>
            Save configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
