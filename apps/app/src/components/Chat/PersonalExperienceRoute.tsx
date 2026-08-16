import { EmptyState } from "~/components/Core/EmptyState";
import { BackLink } from "~/components/Core/BackLink";
import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useCapabilityCatalog } from "~/hooks/useCapabilityCatalog";
import {
	getExperienceBackLink,
	getExperiencePath,
	PERSONAL_SURFACE,
} from "~/lib/capability-surfaces";
import { ContentLoadingSkeleton } from "~/components/Core/LoadingSkeletons";
import { ExperienceRenderer } from "~/components/Experiences/ExperienceRenderer";
import { isAuthenticationError } from "~/lib/errors";

export function PersonalExperienceRoute({
	experienceId,
	subpath = "",
}: {
	experienceId: string;
	subpath?: string;
}) {
	const { data: catalog, isLoading, error: pageError } = useCapabilityCatalog();
	const definition = catalog?.experiences.find((item) => item.id === experienceId);
	const title = definition?.name;
	const backLink = getExperienceBackLink(PERSONAL_SURFACE, experienceId, subpath, title);
	const basePath = getExperiencePath(PERSONAL_SURFACE, experienceId);

	return (
		<PageShell.Content className="max-w-7xl">
			<PageShell.Header title={title ?? "Experience"} />
			<BackLink to={backLink.to} label={backLink.label} />
			{definition && (
				<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
					{definition.description}
				</p>
			)}

			{isLoading ? (
				<ContentLoadingSkeleton />
			) : isAuthenticationError(pageError) ? (
				<SignInEmptyState
					title="Sign in to open this"
					message="This experience keeps your work, so it needs an account."
					className="min-h-[300px]"
				/>
			) : pageError ? (
				<EmptyState title="Experience unavailable" message={pageError.message} />
			) : !definition ? (
				<EmptyState title="Experience not found" message="This experience does not exist." />
			) : (
				<ExperienceRenderer basePath={basePath} runtime={definition.runtime} subpath={subpath} />
			)}
		</PageShell.Content>
	);
}
