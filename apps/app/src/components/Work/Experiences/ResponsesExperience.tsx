import { Puzzle } from "lucide-react";
import { Link } from "react-router";

import { ResponseRenderer } from "~/components/Apps/ResponseRenderer";
import { EmptyState } from "~/components/Core/EmptyState";
import { Card } from "~/components/ui";
import { useDynamicAppResponse, useDynamicAppResponses } from "~/hooks/useDynamicApps";
import { parseRecordValue } from "~/lib/unknown-values";
import { WorkCardGridSkeleton } from "../WorkLoadingSkeletons";

export function ResponsesExperience({ basePath, projectId, subpath }: ExperienceProps) {
	const responseId = subpath.split("/").filter(Boolean)[0];
	const {
		data: responses,
		isLoading,
		error,
	} = useDynamicAppResponses(projectId, undefined, {
		enabled: !responseId,
	});
	const {
		data: response,
		isLoading: isResponseLoading,
		error: responseError,
	} = useDynamicAppResponse(responseId ?? null, projectId);

	if (responseId) {
		if (isResponseLoading) return <WorkCardGridSkeleton count={1} label="Loading app response" />;
		if (responseError || !response)
			return (
				<EmptyState
					title="Response unavailable"
					message={responseError?.message ?? "Response not found"}
				/>
			);
		return (
			<Card className="p-6 shadow-none">
				<ResponseRenderer result={parseRecordValue(response.data)} />
			</Card>
		);
	}
	if (isLoading) return <WorkCardGridSkeleton count={4} label="Loading app responses" />;
	if (error) return <EmptyState title="Responses unavailable" message={error.message} />;
	if (!responses?.length)
		return (
			<EmptyState
				icon={<Puzzle size={24} className="text-zinc-400" />}
				title="No project app responses"
				message="Run one of this project's form-backed apps to save its output here."
			/>
		);

	return (
		<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{responses.map((item) => {
				const data = parseRecordValue(item.data);
				const message = typeof data.message === "string" ? data.message : undefined;
				return (
					<Link
						key={item.id}
						to={`${basePath}/${item.id}`}
						className="group no-underline hover:!no-underline"
					>
						<Card className="h-full gap-3 p-5 shadow-none hover:border-zinc-400 dark:hover:border-zinc-600">
							<p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
								{item.app_id}
							</p>
							<h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
								{message || item.item_type || "App response"}
							</h2>
							<p className="mt-auto pt-3 text-xs text-zinc-400">
								{new Date(item.updated_at).toLocaleString()}
							</p>
						</Card>
					</Link>
				);
			})}
		</div>
	);
}

interface ExperienceProps {
	basePath: string;
	projectId: string;
	subpath: string;
}
