import { Activity } from "lucide-react";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { Card } from "~/components/ui";
import { getStatusIcon } from "~/components/ui/Status/icons";
import { useActivity } from "~/hooks/useActivity";
import { formatDate } from "~/lib/dates";

export function ProjectActivity({ projectId }: { projectId: string }) {
	const { data: activities, isLoading, error } = useActivity(projectId);

	return (
		<main className="container mx-auto max-w-6xl px-4 py-8">
			<PageHeader>
				<PageTitle title="Activity" />
				<p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
					Runs and background work across this project.
				</p>
			</PageHeader>

			{error ? <EmptyState title="Activity unavailable" message={error.message} /> : null}
			{!error && isLoading ? (
				<Card className="p-6 text-sm text-zinc-500 shadow-none">Loading activity…</Card>
			) : null}
			{!error && !isLoading && !activities?.length ? (
				<EmptyState
					icon={<Activity size={24} className="text-zinc-400" />}
					title="No activity yet"
					message="Capability runs will appear here."
					className="min-h-[240px]"
				/>
			) : null}
			{!error && !isLoading && activities?.length ? (
				<Card className="gap-0 overflow-hidden py-0 shadow-none">
					{activities.map((item) => (
						<div
							key={item.id}
							className="flex items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
						>
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
								{getStatusIcon(item.status)}
							</div>
							<div className="min-w-0 flex-1">
								<h2 className="truncate text-sm font-medium">{item.summary}</h2>
								<p className="text-xs text-zinc-500">
									{item.capabilityId} · {formatDate(item.updatedAt ?? item.createdAt)}
								</p>
							</div>
							<span className="text-xs capitalize text-zinc-500">{item.status}</span>
						</div>
					))}
				</Card>
			) : null}
		</main>
	);
}
