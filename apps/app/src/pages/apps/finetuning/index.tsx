import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { FinetuningDashboard } from "~/components/Finetuning/FinetuningDashboard";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";

export function meta() {
	return [
		{ title: "Fine-tuning - Polychat" },
		{
			name: "description",
			content: "Train, inspect, and deploy fine-tuned models from Polychat.",
		},
	];
}

export default function FinetuningPage() {
	const headerContent = (
		<PageHeader>
			<BackLink to="/apps" label="Back to Apps" />
			<PageTitle title="Fine-tuning" />
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
			<FinetuningDashboard />
		</PageShell>
	);
}
