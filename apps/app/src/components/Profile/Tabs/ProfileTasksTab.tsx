import { TaskList } from "@ngriffin_uk/polychat-component-account";

import { ProfileTab } from "~/components/Profile/ProfileTabLayout";
import { useTasks } from "~/hooks/useTasks";

export function ProfileTasksTab() {
  const { tasks, isLoadingTasks } = useTasks({ shouldRefetch: true });

  return (
    <ProfileTab title="Tasks">
      <TaskList tasks={tasks} isLoading={isLoadingTasks} />
    </ProfileTab>
  );
}
