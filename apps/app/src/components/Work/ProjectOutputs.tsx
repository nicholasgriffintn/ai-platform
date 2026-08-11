import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { ResponsesExperience } from "./Experiences/ResponsesExperience";

export function ProjectOutputs({
	workspaceId,
	projectId,
	subpath,
}: {
	workspaceId: string;
	projectId: string;
	subpath: string;
}) {
	return (
		<main className="container mx-auto max-w-6xl px-4 py-8">
			<PageHeader>
				<PageTitle title="Outputs" />
				<p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
					Saved results created by this project’s capabilities.
				</p>
			</PageHeader>
			<ResponsesExperience
				basePath={`/work/${workspaceId}/projects/${projectId}/outputs`}
				projectId={projectId}
				subpath={subpath}
			/>
		</main>
	);
}
