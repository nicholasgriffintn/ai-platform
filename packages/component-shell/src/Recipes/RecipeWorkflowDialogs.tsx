import {
  RecipeConfigurationDialog,
  RecipeScheduleDialog,
} from "@ngriffin_uk/polychat-component-capabilities";

import type { useRecipeWorkflows } from "./useRecipeWorkflows.js";

type RecipeWorkflows = ReturnType<typeof useRecipeWorkflows>;

export function RecipeWorkflowDialogs({ workflows }: { workflows: RecipeWorkflows }) {
  const { configurationDialog, scheduleDialog } = workflows;

  return (
    <>
      <RecipeConfigurationDialog
        recipe={configurationDialog.recipe}
        installation={configurationDialog.installation}
        values={configurationDialog.values}
        onValuesChange={configurationDialog.setValues}
        onClose={configurationDialog.close}
        onSubmit={configurationDialog.submit}
        isLoading={configurationDialog.isLoading}
      />
      <RecipeScheduleDialog
        recipe={scheduleDialog.recipe}
        hasExistingSchedule={scheduleDialog.hasExistingSchedule}
        cronExpression={scheduleDialog.cronExpression}
        timezone={scheduleDialog.timezone}
        prompt={scheduleDialog.prompt}
        notifySms={scheduleDialog.notifySms}
        smsTarget={scheduleDialog.smsTarget}
        onCronExpressionChange={scheduleDialog.setCronExpression}
        onTimezoneChange={scheduleDialog.setTimezone}
        onPromptChange={scheduleDialog.setPrompt}
        onNotifySmsChange={scheduleDialog.setNotifySms}
        onSmsTargetChange={scheduleDialog.setSmsTarget}
        onClose={scheduleDialog.close}
        onSubmit={scheduleDialog.submit}
        isLoading={scheduleDialog.isLoading}
      />
    </>
  );
}
