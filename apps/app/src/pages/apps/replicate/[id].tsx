import type { FC } from "react";
import { useParams } from "react-router";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { ReplicateModelDetail } from "~/components/Replicate/ReplicateModelDetail";

export function meta() {
	return [
		{ title: "Replicate Model - Polychat" },
		{ name: "description", content: "Execute a Replicate AI model" },
	];
}

const ReplicateModelDetailRoute: FC = () => {
	const { id } = useParams<{ id: string }>();

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={
				<PageHeader>
					<BackLink to="/apps/replicate" label="Back to Models" />
				</PageHeader>
			}
		>
			<ReplicateModelDetail modelId={id || ""} />
		</PageShell>
	);
};

export default ReplicateModelDetailRoute;
