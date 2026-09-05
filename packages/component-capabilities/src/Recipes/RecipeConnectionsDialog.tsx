import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { getRecipeIntegrationStatusLabel } from "@ngriffin_uk/polychat-schemas";
import type { AssistantRecipe } from "@ngriffin_uk/polychat-schemas";
import { Check, Plug } from "lucide-react";

type RecipeIntegration = AssistantRecipe["integrations"][number];

function getIntegrationStatusDetail(
  integration: RecipeIntegration,
  integrations: RecipeIntegration[],
) {
  if (integration.connectionStatus === "connected") {
    return null;
  }

  if (!integration.requiresConnection) {
    return "Optional — adds extra context when connected";
  }

  if (!integration.connectionGroup) {
    return null;
  }

  const alternatives = integrations.filter(
    (candidate) =>
      candidate.id !== integration.id && candidate.connectionGroup === integration.connectionGroup,
  );

  if (alternatives.length === 0) {
    return null;
  }

  const connectedAlternative = alternatives.find(
    (candidate) => candidate.connectionStatus === "connected",
  );

  return connectedAlternative
    ? `Optional — ${connectedAlternative.name} already covers this`
    : "Connect this or an alternative below";
}

export function RecipeConnectionsDialog({
  integrations,
  isConnecting,
  onConnect,
  onOpenChange,
  open,
  recipeTitle,
}: {
  integrations: RecipeIntegration[];
  isConnecting: boolean;
  onConnect: (integration: RecipeIntegration) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  recipeTitle: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{recipeTitle} connections</DialogTitle>
        <DialogDescription>
          Manage this recipe’s connections. Services listed as alternatives only need one connected.
        </DialogDescription>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border">
          {integrations.map((integration) => {
            const isConnected = integration.connectionStatus === "connected";
            const isUnavailable = integration.connectionStatus === "unconfigured";
            const statusDetail = getIntegrationStatusDetail(integration, integrations);

            return (
              <div
                key={integration.id}
                className="flex min-h-16 items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{integration.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {statusDetail ?? getRecipeIntegrationStatusLabel(integration.connectionStatus)}
                  </p>
                </div>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                    <Check className="size-3.5" /> Connected
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="xs"
                    icon={<Plug className="size-3.5" />}
                    disabled={isUnavailable || isConnecting}
                    onClick={() => onConnect(integration)}
                  >
                    {isUnavailable ? "Unavailable" : "Connect"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
