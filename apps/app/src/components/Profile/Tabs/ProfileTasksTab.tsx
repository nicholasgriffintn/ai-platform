import { TaskList } from "@ngriffin_uk/polychat-component-account";

import { useTasks } from "~/hooks/useTasks";
import { PageShell } from "../../Core/PageShell";

export function ProfileTasksTab() {
	const { tasks, isLoadingTasks } = useTasks({ shouldRefetch: true });

	return (
		<div>
			<PageShell.Header title="Tasks" />
			<TaskList tasks={tasks} isLoading={isLoadingTasks} />
		</div>
	);
}
