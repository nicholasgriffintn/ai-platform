import {
  RecipeConfigurationDialog,
  RecipeConfigurationSummaryDialog,
  RecipeScheduleDialog,
} from "@ngriffin_uk/polychat-component-capabilities";
import { ConfirmationDialog, FormDialog, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { ScheduledRecipeList } from "@ngriffin_uk/polychat-component-workspaces";
import { getRecipeScheduleTrigger } from "@ngriffin_uk/polychat-schemas";
import type {
  AssistantRecipe,
  ProjectCapability,
  RecipeInstallation,
  WorkspaceMember,
} from "@ngriffin_uk/polychat-schemas";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";
import { useMemo, useState } from "react";

import { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import { useAssistantRecipes, useRecipeInstallations } from "~/hooks/useRecipes";
import { useChatStore } from "~/state/stores/chatStore";

export function ProjectSchedulesCard({
  workspaceId,
  projectId,
  capabilities,
  members,
  embedded = false,
}: {
  workspaceId: string;
  projectId: string;
  capabilities: ProjectCapability[];
  members: WorkspaceMember[];
  embedded?: boolean;
}) {
  const currentUserId = useChatStore((state) => state.user?.id);
  const recipes = useAssistantRecipes();
  const installations = useRecipeInstallations(projectId);
  const workflows = useRecipeWorkflows({
    conversationPath: `/work/${workspaceId}/projects/${projectId}/chat`,
    projectId,
  });
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [configurationView, setConfigurationView] = useState<{
    recipe: AssistantRecipe;
    installation: RecipeInstallation;
  } | null>(null);
  const [scheduleToStop, setScheduleToStop] = useState<{
    recipe: AssistantRecipe;
    installation: RecipeInstallation;
  } | null>(null);
  const enabledRecipeIds = useMemo(
    () =>
      new Set(
        capabilities
          .filter((capability) => capability.kind === "recipe")
          .map((capability) => capability.capabilityId),
      ),
    [capabilities],
  );
  const schedulableRecipes = (recipes.data?.recipes ?? []).filter(
    (recipe) =>
      enabledRecipeIds.has(recipe.id) &&
      recipe.triggers.some((trigger) => trigger.type === "schedule"),
  );
  const recipeById = new Map((recipes.data?.recipes ?? []).map((recipe) => [recipe.id, recipe]));
  const projectInstallations = installations.data?.installations ?? [];
  const scheduleEntries = projectInstallations.flatMap((installation) => {
    const trigger = getRecipeScheduleTrigger(installation);
    return trigger
      ? [{ installation, trigger, recipe: recipeById.get(installation.recipeId) }]
      : [];
  });
  const ownInstallationByRecipeId = new Map(
    projectInstallations
      .filter((installation) => areUserIdsEqual(installation.userId, currentUserId))
      .map((installation) => [installation.recipeId, installation]),
  );
  const memberNameById = new Map(
    members.map((member) => [String(member.userId), member.name || member.email]),
  );

  const openRecipePicker = () => {
    setSelectedRecipeId(schedulableRecipes[0]?.id ?? "");
    setIsRecipePickerOpen(true);
  };

  const entries = scheduleEntries.map(({ installation, recipe, trigger }) => ({
    id: installation.id,
    title: recipe?.title ?? installation.recipeId,
    cronExpression: trigger.cronExpression,
    isPaused: !trigger.enabled || installation.status === "paused",
    memberName: memberNameById.get(String(installation.userId)) ?? "Project member",
    canManage: areUserIdsEqual(installation.userId, currentUserId),
    isUpdating: recipe
      ? workflows.actions.getRecipeCardState(recipe, installation).isUpdatingInstallation
      : false,
    canViewConfiguration: !!recipe,
  }));

  const entryById = new Map(
    scheduleEntries.map((entry) => [entry.installation.id, entry] as const),
  );

  return (
    <>
      <ScheduledRecipeList
        entries={entries}
        embedded={embedded}
        canSchedule={schedulableRecipes.length > 0}
        onSchedule={openRecipePicker}
        onViewConfiguration={(entryId) => {
          const entry = entryById.get(entryId);
          if (entry?.recipe) {
            setConfigurationView({ recipe: entry.recipe, installation: entry.installation });
          }
        }}
        onEditSchedule={(entryId) => {
          const entry = entryById.get(entryId);
          if (entry?.recipe) workflows.actions.openScheduleDialog(entry.recipe, entry.installation);
        }}
        onToggleEnabled={(entryId, enabled) => {
          const entry = entryById.get(entryId);
          if (entry) void workflows.actions.setScheduleEnabled(entry.installation, enabled);
        }}
        onStopSchedule={(entryId) => {
          const entry = entryById.get(entryId);
          if (entry?.recipe) {
            setScheduleToStop({ recipe: entry.recipe, installation: entry.installation });
          }
        }}
      />

      <FormDialog
        open={isRecipePickerOpen}
        onOpenChange={setIsRecipePickerOpen}
        title="Schedule a project recipe"
        description="The run uses your connected accounts and is visible to project members."
        submitText="Continue"
        submitDisabled={!selectedRecipeId}
        onSubmit={() => {
          const recipe = schedulableRecipes.find((candidate) => candidate.id === selectedRecipeId);
          if (!recipe) return;
          setIsRecipePickerOpen(false);
          workflows.actions.openScheduleDialog(recipe, ownInstallationByRecipeId.get(recipe.id));
        }}
      >
        <FormSelect
          label="Recipe"
          value={selectedRecipeId}
          onChange={(event) => setSelectedRecipeId(event.target.value)}
          options={schedulableRecipes.map((recipe) => ({
            value: recipe.id,
            label: recipe.title,
          }))}
        />
      </FormDialog>

      <RecipeConfigurationDialog
        recipe={workflows.configurationDialog.recipe}
        installation={workflows.configurationDialog.installation}
        values={workflows.configurationDialog.values}
        onValuesChange={workflows.configurationDialog.setValues}
        onClose={workflows.configurationDialog.close}
        onSubmit={workflows.configurationDialog.submit}
        isLoading={workflows.configurationDialog.isLoading}
      />
      <RecipeScheduleDialog
        recipe={workflows.scheduleDialog.recipe}
        hasExistingSchedule={workflows.scheduleDialog.hasExistingSchedule}
        cronExpression={workflows.scheduleDialog.cronExpression}
        prompt={workflows.scheduleDialog.prompt}
        notifySms={workflows.scheduleDialog.notifySms}
        smsTarget={workflows.scheduleDialog.smsTarget}
        onCronExpressionChange={workflows.scheduleDialog.setCronExpression}
        onPromptChange={workflows.scheduleDialog.setPrompt}
        onNotifySmsChange={workflows.scheduleDialog.setNotifySms}
        onSmsTargetChange={workflows.scheduleDialog.setSmsTarget}
        onClose={workflows.scheduleDialog.close}
        onSubmit={workflows.scheduleDialog.submit}
        isLoading={workflows.scheduleDialog.isLoading}
      />
      <RecipeConfigurationSummaryDialog
        recipe={configurationView?.recipe ?? null}
        installation={configurationView?.installation ?? null}
        onOpenChange={(open) => {
          if (!open) setConfigurationView(null);
        }}
      />
      <ConfirmationDialog
        open={scheduleToStop !== null}
        onOpenChange={(open) => {
          if (!open) setScheduleToStop(null);
        }}
        title="Stop recipe schedule"
        description={`Stop the ${scheduleToStop?.recipe.title ?? "recipe"} schedule? Its saved configuration and recipe installation will be kept.`}
        confirmText="Stop schedule"
        variant="destructive"
        isLoading={
          scheduleToStop
            ? workflows.actions.getRecipeCardState(
                scheduleToStop.recipe,
                scheduleToStop.installation,
              ).isUpdatingInstallation
            : false
        }
        onConfirm={async () => {
          if (!scheduleToStop) return;
          await workflows.actions.stopSchedule(scheduleToStop.installation);
          setScheduleToStop(null);
        }}
      />
    </>
  );
}
