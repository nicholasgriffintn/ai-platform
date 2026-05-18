import { AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Alert, AlertDescription, AlertTitle, Button } from "~/components/ui";
import { SandboxChatConsole } from "./connection/SandboxChatConsole";
import { SandboxRunSidebar } from "./connection/SandboxRunSidebar";
import { useSandboxRunConsole } from "./connection/useSandboxRunConsole";

export function meta() {
	return [
		{ title: "Sandbox Run Console - Polychat" },
		{
			name: "description",
			content:
				"Run sandbox tasks against a connected GitHub repository and follow streamed command progress.",
		},
	];
}

export default function SandboxConnectionPage() {
	const navigate = useNavigate();
	const c = useSandboxRunConsole();

	if (!c.hasValidInstallationId) {
		return (
			<PageShell sidebarContent={<AppsSidebarContent />} className="max-w-7xl mx-auto">
				<Alert variant="destructive">
					<AlertTitle>Invalid connection id</AlertTitle>
					<AlertDescription>
						The sandbox connection URL is invalid. Return to{" "}
						<Link to="/apps/sandbox" className="underline">
							Sandbox Worker
						</Link>
						.
					</AlertDescription>
				</Alert>
			</PageShell>
		);
	}

	const handleNewRun = () => {
		c.setSelectedRunInUrl(undefined);
		c.setTask("");
		c.setOperatorMessage("");
	};

	return (
		<PageShell
			sidebarContent={
				<SandboxRunSidebar
					installationId={c.installationId}
					runs={c.runs}
					isRunsLoading={c.isRunsLoading}
					runsError={c.runsError}
					targetRunId={c.targetRunId}
					onSelectRun={c.setSelectedRunInUrl}
					onNewRun={handleNewRun}
				/>
			}
			fullBleed
			headerContent={
				<PageTitle title={`Sandbox installation ${c.installationId}`} className="sr-only" />
			}
		>
			{c.isLoading ? (
				<div className="p-6 text-sm text-muted-foreground">Loading connection...</div>
			) : c.error ? (
				<Alert variant="destructive" className="m-6">
					<AlertTitle>Unable to load connection</AlertTitle>
					<AlertDescription>
						{c.error instanceof Error ? c.error.message : "Unknown error"}
					</AlertDescription>
				</Alert>
			) : !c.connection ? (
				<EmptyState
					icon={<AlertCircle className="h-8 w-8 text-zinc-400" />}
					title="Connection not found"
					message="This installation is not available in your account."
					action={
						<Button variant="primary" onClick={() => navigate("/apps/sandbox")}>
							Back to sandbox
						</Button>
					}
					className="min-h-[360px]"
				/>
			) : (
				<SandboxChatConsole consoleState={c} />
			)}
		</PageShell>
	);
}
