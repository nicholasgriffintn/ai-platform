import { SettingsSection, TaskList } from "@ngriffin_uk/polychat-component-account";
import { useTasks } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

export function AttentionBackgroundTasks() {
  const { tasks, isLoadingTasks, tasksError } = useTasks({ shouldRefetch: true });

  return (
    <SettingsSection
      title="Your background tasks"
      description="Automations, media processing and other work running for your account."
    >
      {tasksError ? (
        <p role="alert" className="text-sm text-failure">
          {getErrorMessage(tasksError, "Background tasks could not be loaded")}
        </p>
      ) : null}
      {!tasksError || tasks.length > 0 ? (
        <TaskList tasks={tasks} isLoading={isLoadingTasks} />
      ) : null}
    </SettingsSection>
  );
}
