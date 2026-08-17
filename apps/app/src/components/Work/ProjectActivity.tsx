import { ProjectActivityList } from "@ngriffin_uk/polychat-component-workspaces";

import { PageShell } from "~/components/Core/PageShell";
import { useActivity } from "~/hooks/useActivity";

export function ProjectActivity({ projectId }: { projectId: string }) {
	const {
		data: activities,
		isLoading,
		error,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useActivity(projectId);

	return (
		<PageShell.Content className="max-w-6xl">
			<PageShell.Header title="Activity" />
			<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
				Runs and background work across this project.
			</p>

			<ProjectActivityList
				activities={activities ?? []}
				isLoading={isLoading}
				errorMessage={error?.message}
				hasMore={Boolean(hasNextPage)}
				isLoadingMore={isFetchingNextPage}
				onLoadMore={() => void fetchNextPage()}
			/>
		</PageShell.Content>
	);
}
