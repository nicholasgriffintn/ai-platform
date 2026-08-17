import {
	ExperienceGrid,
	ManageCapabilitiesLink,
} from "@ngriffin_uk/polychat-component-capabilities";
import {
	Button,
	CardGridLoadingSkeleton,
	EmptyState,
	Link,
} from "@ngriffin_uk/polychat-component-ui";
import { Puzzle } from "lucide-react";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useCapabilityCatalog } from "~/hooks/useCapabilityCatalog";
import {
	getCapabilityLibraryPath,
	getExperiencePath,
	PERSONAL_SURFACE,
} from "~/lib/capability-surfaces";
import { isAuthenticationError } from "~/lib/errors";

export function PersonalExperiences() {
	const { data: catalog, isLoading, error: pageError } = useCapabilityCatalog();
	const experiences = catalog?.experiences ?? [];
	const libraryPath = getCapabilityLibraryPath(PERSONAL_SURFACE);

	return (
		<PageShell.Content className="max-w-6xl">
			<PageShell.Header
				title="Experiences"
				actionContent={<ManageCapabilitiesLink href={libraryPath} />}
			/>
			<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
				Longer jobs that need more room than a message: writing, reading, listening, and making
				things.
			</p>

			{isLoading ? (
				<CardGridLoadingSkeleton
					count={6}
					gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
					label="Loading your experiences"
				/>
			) : isAuthenticationError(pageError) ? (
				<SignInEmptyState
					title="Sign in to open these"
					message="Your notes, articles, podcasts, and patterns live behind sign-in."
					className="min-h-[300px]"
				/>
			) : pageError ? (
				<EmptyState title="Experiences unavailable" message={pageError.message} />
			) : experiences.length === 0 ? (
				<EmptyState
					icon={<Puzzle size={24} className="text-zinc-400" />}
					title="Nothing to open yet"
					message="Experiences will appear here once the catalogue loads."
					action={
						<Link href={libraryPath}>
							<Button variant="primary">Browse capabilities</Button>
						</Link>
					}
					className="min-h-[260px]"
				/>
			) : (
				<ExperienceGrid
					experiences={experiences.map((experience) => ({
						...experience,
						href: getExperiencePath(PERSONAL_SURFACE, experience.id),
					}))}
				/>
			)}
		</PageShell.Content>
	);
}
