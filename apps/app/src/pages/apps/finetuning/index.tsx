import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { TrainingDashboard } from "~/components/Training/TrainingDashboard";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";

export function meta() {
	return [
		{ title: "Training - Polychat" },
		{
			name: "description",
			content: "Train, inspect, import, and deploy models from Polychat.",
		},
	];
}

export default function TrainingPage() {
	const headerContent = (
		<PageHeader>
			<BackLink to="/apps" label="Back to Apps" />
			<PageTitle title="Training" />
			<p className="text-sm text-muted-foreground">
				Manage training jobs, logs, deployments, and model definitions.
			</p>
		</PageHeader>
	);

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={headerContent}
		>
			<TrainingDashboard />
		</PageShell>
	);
}
