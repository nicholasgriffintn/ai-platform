import { useParams } from "react-router";

import { SourcesLibrary } from "~/components/Profile/Tabs/ProfileSourcesTab";

export default function ProjectSourcesPage() {
	const { projectId } = useParams<{ projectId: string }>();
	return projectId ? (
		<main className="container mx-auto max-w-6xl px-4 py-8">
			<SourcesLibrary projectId={projectId} title="Sources" />
		</main>
	) : null;
}
