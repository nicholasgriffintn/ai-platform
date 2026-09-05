import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import {
  getBlockingRecipeIntegrations,
  getRecipeScheduleTrigger,
  isRecipeConfigured,
  recipeKindLabels,
  recipeSupportsSchedule,
} from "@ngriffin_uk/polychat-schemas";
import type { AssistantRecipe, RecipeInstallation } from "@ngriffin_uk/polychat-schemas";
import {
  CalendarClock,
  Activity,
  ChevronRight,
  PauseCircle,
  PlayCircle,
  Plug,
  Settings2,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { RecipeConnectionsDialog } from "./RecipeConnectionsDialog";

interface RecipeCardProps {
  headerAccessory?: ReactNode;
  inactiveAction?: ReactNode;
  recipe: AssistantRecipe;
  installation?: RecipeInstallation;
  onStart: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
  onConfigure: (providerId: string, setupUrl?: string) => void;
  onEditConfiguration: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
  onSchedule: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
  onManageEventTriggers?: (recipe: AssistantRecipe, installation: RecipeInstallation) => void;
  onToggleInstallationStatus: (installation: RecipeInstallation) => void;
  onDeleteInstallation: (installation: RecipeInstallation) => void;
  isStarting: boolean;
  isConfiguring: boolean;
  isEditingConfiguration: boolean;
  isScheduling: boolean;
  isUpdatingInstallation: boolean;
}

export function RecipeCard({
  headerAccessory,
  inactiveAction,
  recipe,
  installation,
  onStart,
  onConfigure,
  onEditConfiguration,
  onSchedule,
  onManageEventTriggers,
  onToggleInstallationStatus,
  onDeleteInstallation,
  isStarting,
  isConfiguring,
  isEditingConfiguration,
  isScheduling,
  isUpdatingInstallation,
}: RecipeCardProps) {
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const hasUnavailableIntegration = getBlockingRecipeIntegrations(recipe).some(
    (integration) => integration.connectionStatus === "unconfigured",
  );
  const canSchedule = recipeSupportsSchedule(recipe);
  const canConfigure = recipe.configurationFields.length > 0;
  const canUseEventTriggers = recipe.triggers.some((trigger) => trigger.type === "event");
  const scheduleTrigger = getRecipeScheduleTrigger(installation);
  const isPaused = installation?.status === "paused";
  const isConfigured = isRecipeConfigured(recipe, installation);
  const setupStatus = isPaused
    ? "Paused"
    : isConfigured
      ? "Ready"
      : installation
        ? "Setup incomplete"
        : "Not set up";

  return (
    <>
      <Card className="flex h-full flex-col border-border bg-surface">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md border border-border bg-surface-elevated p-2 text-foreground">
                {recipe.kind === "automate" ? (
                  <WandSparkles className="h-4 w-4" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}
              </div>
              <Badge variant="outline">{recipeKindLabels[recipe.kind]}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span
                role="img"
                aria-label={`Status: ${setupStatus}`}
                title={setupStatus}
                className={cn(
                  "size-2.5 rounded-full ring-2",
                  isPaused ? "bg-attention" : isConfigured ? "bg-success" : "bg-selection",
                )}
              />
              {recipe.featured && (
                <span
                  role="img"
                  aria-label="Featured recipe"
                  title="Featured recipe"
                  className="rounded-full bg-failure/12 p-1.5 text-failure"
                >
                  <Sparkles className="h-4 w-4" />
                </span>
              )}
              {headerAccessory}
            </div>
          </div>
          <div>
            <CardTitle className="text-lg">{recipe.title}</CardTitle>
            <CardDescription className="mt-1 leading-6">{recipe.summary}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          {recipe.integrations.length > 0 && !inactiveAction && (
            <Button
              variant="outline"
              aria-label={`Connections, ${recipe.integrations.length}`}
              onClick={() => setConnectionsOpen(true)}
              className="group w-fit"
            >
              <span>Connections</span>
              <span className="min-w-5 rounded-full bg-surface-elevated px-1.5 text-center text-xs tabular-nums text-muted-foreground">
                {recipe.integrations.length}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Button>
          )}

          <div className="mt-auto space-y-3 border-t border-border pt-4">
            {inactiveAction ?? (
              <>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => onStart(recipe, installation)}
                  isLoading={isStarting}
                  disabled={hasUnavailableIntegration}
                >
                  {installation ? (isConfigured ? "Run" : "Continue setup") : "Set up"}
                </Button>
                {(canConfigure || canSchedule) && (
                  <div className={cn("grid gap-2", canConfigure && canSchedule && "grid-cols-2")}>
                    {canConfigure && (
                      <Button
                        variant="secondary"
                        fullWidth
                        icon={<Settings2 className="h-4 w-4" />}
                        onClick={() => onEditConfiguration(recipe, installation)}
                        isLoading={isEditingConfiguration}
                      >
                        Preferences
                      </Button>
                    )}
                    {canSchedule && (
                      <Button
                        variant="secondary"
                        fullWidth
                        icon={<CalendarClock className="h-4 w-4" />}
                        onClick={() => onSchedule(recipe, installation)}
                        isLoading={isScheduling}
                        disabled={!isConfigured}
                      >
                        {scheduleTrigger ? "Edit schedule" : "Schedule"}
                      </Button>
                    )}
                  </div>
                )}
                {installation && canUseEventTriggers && onManageEventTriggers && (
                  <Button
                    variant="secondary"
                    fullWidth
                    icon={<Activity className="h-4 w-4" />}
                    onClick={() => onManageEventTriggers(recipe, installation)}
                    disabled={!isConfigured || isPaused}
                  >
                    Manage event triggers
                  </Button>
                )}
                {installation && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={
                        isPaused ? (
                          <PlayCircle className="h-4 w-4" />
                        ) : (
                          <PauseCircle className="h-4 w-4" />
                        )
                      }
                      onClick={() => onToggleInstallationStatus(installation)}
                      isLoading={isUpdatingInstallation}
                    >
                      {isPaused ? "Resume" : "Pause"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => onDeleteInstallation(installation)}
                      disabled={isUpdatingInstallation}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <RecipeConnectionsDialog
        integrations={recipe.integrations}
        isConnecting={isConfiguring}
        onConnect={(integration) => {
          setConnectionsOpen(false);
          onConfigure(integration.providerId, integration.setupUrl);
        }}
        onOpenChange={setConnectionsOpen}
        open={connectionsOpen}
        recipeTitle={recipe.title}
      />
    </>
  );
}
