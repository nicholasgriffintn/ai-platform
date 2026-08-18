import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import type { RecipeConnectorManifest } from "@ngriffin_uk/polychat-schemas";

type ConnectorAuthConfig = NonNullable<RecipeConnectorManifest["authConfigs"]>[number];

interface ConnectorAuthConfigModalProps {
  configs: ConnectorAuthConfig[];
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (authConfigId: string) => void;
  providerName: string;
}

export function ConnectorAuthConfigModal({
  configs,
  isLoading,
  onOpenChange,
  onSelect,
  providerName,
}: ConnectorAuthConfigModalProps) {
  return (
    <Dialog open={configs.length > 0} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {providerName}</DialogTitle>
          <DialogDescription>
            Choose the Composio auth config to use for this connection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {configs.map((config) => (
            <Button
              key={config.id}
              variant="outline"
              fullWidth
              disabled={isLoading}
              onClick={() => onSelect(config.id)}
              className="justify-start"
            >
              <span className="flex w-full items-center justify-between gap-4 text-left">
                <span>{config.name}</span>
                <span className="text-xs text-zinc-500">{config.authScheme}</span>
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
