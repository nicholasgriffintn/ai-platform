import type { FC } from "react";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { ReplicatePredictions } from "~/components/Replicate/ReplicatePredictions";

export function meta() {
	return [
		{ title: "My Predictions - Polychat" },
		{ name: "description", content: "View your Replicate model predictions" },
	];
}

const ReplicatePredictionsRoute: FC = () => {
	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-6xl mx-auto"
			headerContent={
				<PageHeader>
					<BackLink to="/apps/replicate" label="Back to Models" />
					<PageTitle title="My Predictions" />
				</PageHeader>
			}
		>
			<ReplicatePredictions />
		</PageShell>
	);
};

export default ReplicatePredictionsRoute;
