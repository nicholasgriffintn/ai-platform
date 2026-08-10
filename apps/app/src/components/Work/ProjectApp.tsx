import { useState } from "react";

import { DynamicForm } from "~/components/Apps/DynamicForm";
import { ResponseRenderer } from "~/components/Apps/ResponseRenderer";
import { BackLink } from "~/components/Core/BackLink";
import { Card } from "~/components/ui";
import { useDynamicApp, useExecuteDynamicApp } from "~/hooks/useDynamicApps";
import { useWorkData } from "./WorkContext";
import { ProjectAppSkeleton } from "./WorkLoadingSkeletons";

export function ProjectApp({
	workspaceId,
	projectId,
	appId,
}: {
	workspaceId: string;
	projectId: string;
	appId: string;
}) {
	const { projectQuery } = useWorkData();
	const { data: project, isLoading: isProjectLoading } = projectQuery;
	const { data: app, isLoading: isAppLoading, error } = useDynamicApp(appId);
	const executeApp = useExecuteDynamicApp();
	const [result, setResult] = useState<Record<string, unknown> | null>(null);
	const hasCapability = project?.capabilities.some(
		(capability) => capability.kind === "app" && capability.capabilityId === appId,
	);

	if (isProjectLoading || isAppLoading) {
		return <ProjectAppSkeleton />;
	}

	if (error || !app || !hasCapability) {
		return (
			<main className="mx-auto max-w-xl px-6 py-16">
				<Card className="p-8 text-center shadow-none">
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">App unavailable</h1>
					<p className="text-sm leading-6 text-zinc-500">
						This app is not enabled for the project, or it no longer exists.
					</p>
					<BackLink
						to={`/work/${workspaceId}/projects/${projectId}/library`}
						label="Back to capabilities"
					/>
				</Card>
			</main>
		);
	}

	const handleSubmit = async (formData: Record<string, unknown>) => {
		return executeApp.mutateAsync({ id: appId, formData, projectId });
	};

	return (
		<>
			<main className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14">
				<header className="mb-8">
					<BackLink
						to={`/work/${workspaceId}/projects/${projectId}/library`}
						label="Back to capabilities"
					/>
				</header>
				{result ? (
					<ResponseRenderer app={app} result={result} onReset={() => setResult(null)} />
				) : (
					<DynamicForm
						app={app}
						onSubmit={handleSubmit}
						onComplete={setResult}
						isSubmitting={executeApp.isPending}
					/>
				)}
			</main>
		</>
	);
}
