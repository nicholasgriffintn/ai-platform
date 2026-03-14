import { Hammer, Link2, MonitorDot, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui";
import { SandboxAddGitHubConnection } from "~/components/Models/SandboxAddGitHubConnection";
import {
	useConnectSandboxInstallation,
	useDeleteSandboxConnection,
	useSandboxConnections,
	useSandboxInstallConfig,
	useSandboxRuns,
} from "~/hooks/useSandbox";
import { formatRelativeTime } from "~/lib/dates";
import { getStatusBadgeVariant } from "./utils";

export interface ConnectionFormState {
	installationId: string;
	appId: string;
	privateKey: string;
	webhookSecret: string;
	repositories: string;
}

const INITIAL_FORM: ConnectionFormState = {
	installationId: "",
	appId: "",
	privateKey: "",
	webhookSecret: "",
	repositories: "",
};

export function meta() {
	return [
		{ title: "Sandbox Worker - Polychat" },
		{
			name: "description",
			content:
				"Connect to a GitHub repo to automate tasks in an isolated sandbox environment.",
		},
	];
}

export default function SandboxConnectionsPage() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
	const processedInstallationRef = useRef<string | null>(null);
	const [form, setForm] = useState<ConnectionFormState>(INITIAL_FORM);

	const { data: connections = [], isLoading, error } = useSandboxConnections();
	const { data: installConfig, isLoading: isInstallConfigLoading } =
		useSandboxInstallConfig();
	const {
		data: runs = [],
		isLoading: isRunsLoading,
		error: runsError,
	} = useSandboxRuns({ limit: 12 });
	const connectInstallationMutation = useConnectSandboxInstallation();
	const deleteConnectionMutation = useDeleteSandboxConnection();

	const totalRepositories = useMemo(() => {
		return connections.reduce(
			(total, connection) => total + connection.repositories.length,
			0,
		);
	}, [connections]);

	useEffect(() => {
		const rawInstallationId =
			searchParams.get("installation_id") || searchParams.get("installationId");

		if (!rawInstallationId) {
			processedInstallationRef.current = null;
			return;
		}

		if (processedInstallationRef.current === rawInstallationId) {
			return;
		}
		processedInstallationRef.current = rawInstallationId;

		if (isInstallConfigLoading) {
			processedInstallationRef.current = null;
			return;
		}

		const clearInstallParams = () => {
			const next = new URLSearchParams(searchParams);
			next.delete("installation_id");
			next.delete("installationId");
			next.delete("setup_action");
			next.delete("state");
			setSearchParams(next, { replace: true });
		};

		const installationId = Number(rawInstallationId);
		if (!Number.isFinite(installationId) || installationId <= 0) {
			toast.error("GitHub installation id in callback URL is invalid");
			clearInstallParams();
			return;
		}

		if (!installConfig?.canAutoConnect) {
			toast.info(
				"GitHub install detected. Open Add connection and save it manually.",
			);
			clearInstallParams();
			setIsConnectionModalOpen(true);
			setForm((prev) => ({
				...prev,
				installationId: String(installationId),
			}));
			return;
		}

		void (async () => {
			try {
				await connectInstallationMutation.mutateAsync({ installationId });
				toast.success(`Connected GitHub installation ${installationId}`);
			} catch (connectError) {
				toast.error(
					connectError instanceof Error
						? connectError.message
						: "Failed to connect GitHub installation",
				);
			} finally {
				clearInstallParams();
			}
		})();
	}, [
		connectInstallationMutation,
		installConfig?.canAutoConnect,
		isInstallConfigLoading,
		searchParams,
		setSearchParams,
	]);

	const handleDeleteConnection = async (installationId: number) => {
		if (
			!window.confirm(
				`Delete the connection for installation ${installationId}?`,
			)
		) {
			return;
		}

		try {
			await deleteConnectionMutation.mutateAsync(installationId);
			toast.success("Connection deleted");
		} catch (mutationError) {
			toast.error(
				mutationError instanceof Error
					? mutationError.message
					: "Failed to delete connection",
			);
		}
	};

	return (
		<>
			<PageShell
				sidebarContent={<AppsSidebarContent />}
				className="max-w-7xl mx-auto"
				headerContent={
					<div className="flex flex-wrap items-start justify-between gap-4">
						<PageHeader>
							<BackLink to="/apps" label="Back to Apps" />
							<PageTitle title="Sandbox Worker" />
							<p className="text-sm text-muted-foreground max-w-3xl">
								Connect to your GitHub repositories and automate tasks in an
								isolated sandbox environment.
							</p>
						</PageHeader>
						<Button
							variant="primary"
							icon={<Plus className="h-4 w-4" />}
							onClick={() => setIsConnectionModalOpen(true)}
						>
							Add GitHub connection
						</Button>
					</div>
				}
			>
				<div className="space-y-6">
					<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
						<Card>
							<CardHeader>
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-zinc-900/10 p-2 text-zinc-900 dark:text-zinc-100">
										<MonitorDot className="h-5 w-5" />
									</div>
									<div>
										<CardTitle>Recent sandbox runs</CardTitle>
										<CardDescription>
											Your most recent sandbox runs across all connections.
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="max-h-[400px] overflow-y-auto">
								{isRunsLoading ? (
									<div className="text-sm text-muted-foreground">
										Loading run history...
									</div>
								) : runsError ? (
									<Alert variant="destructive">
										<AlertTitle>Unable to load runs</AlertTitle>
										<AlertDescription>
											{runsError instanceof Error
												? runsError.message
												: "Unknown error"}
										</AlertDescription>
									</Alert>
								) : runs.length === 0 ? (
									<EmptyState
										icon={<MonitorDot className="h-8 w-8 text-zinc-400" />}
										title="No runs yet"
										message="Open a connected repository and trigger a sandbox task to see the run history here."
										className="min-h-[260px]"
									/>
								) : (
									<div className="space-y-3">
										{runs.map((run) => (
											<div
												key={run.runId}
												className="rounded-lg border bg-card p-3 text-sm"
											>
												<div className="flex items-center justify-between gap-3">
													<Link
														to={`/apps/sandbox/${run.installationId}?runId=${run.runId}`}
														className="font-medium text-zinc-900 dark:text-zinc-100 no-underline hover:text-blue-600 dark:hover:text-blue-300"
													>
														{run.repo}
													</Link>
													<Badge variant={getStatusBadgeVariant(run.status)}>
														{run.status}
													</Badge>
												</div>
												<p className="mt-1 text-muted-foreground line-clamp-2">
													{run.task}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Updated {formatRelativeTime(run.updatedAt)}
												</p>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-zinc-900/10 p-2 text-zinc-900 dark:text-zinc-100">
										<Link2 className="h-5 w-5" />
									</div>
									<div>
										<CardTitle>Repository connections</CardTitle>
										<CardDescription>
											{connections.length} installation
											{connections.length === 1 ? "" : "s"} connected across{" "}
											{totalRepositories} scoped repositor
											{totalRepositories === 1 ? "y" : "ies"}.
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="max-h-[400px] overflow-y-auto">
								{isLoading ? (
									<div className="text-sm text-muted-foreground">
										Loading connections...
									</div>
								) : error ? (
									<Alert variant="destructive">
										<AlertTitle>Unable to load connections</AlertTitle>
										<AlertDescription>
											{error instanceof Error ? error.message : "Unknown error"}
										</AlertDescription>
									</Alert>
								) : connections.length === 0 ? (
									<EmptyState
										icon={<Link2 className="h-8 w-8 text-zinc-400" />}
										title="No sandbox connections yet"
										message="Install the GitHub App or add a connection manually to start running sandbox tasks."
										className="min-h-[260px]"
									/>
								) : (
									<div className="space-y-3">
										{connections.map((connection) => (
											<div
												key={connection.installationId}
												className="rounded-lg border bg-card p-4"
											>
												<div className="flex flex-wrap items-start justify-between gap-3">
													<div className="space-y-1">
														<Link
															to={`/apps/sandbox/${connection.installationId}`}
															className="text-sm font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-300 no-underline"
														>
															Installation {connection.installationId}
														</Link>
														<p className="text-xs text-muted-foreground">
															App ID: {connection.appId}
														</p>
														<p className="text-xs text-muted-foreground">
															Updated {formatRelativeTime(connection.updatedAt)}
														</p>
													</div>
													<div className="flex items-center gap-2">
														<Button
															variant="destructive"
															size="sm"
															icon={<Trash2 className="h-4 w-4" />}
															onClick={() =>
																handleDeleteConnection(
																	connection.installationId,
																)
															}
															isLoading={deleteConnectionMutation.isPending}
														>
															Remove
														</Button>
														<Button
															variant="primary"
															size="sm"
															icon={<Hammer className="h-4 w-4" />}
															onClick={() =>
																navigate(
																	`/apps/sandbox/${connection.installationId}`,
																)
															}
														>
															Open
														</Button>
													</div>
												</div>
												<div className="mt-3 flex flex-wrap gap-2">
													<Badge variant="outline">
														{connection.repositories.length || "Any"} repo
														{connection.repositories.length === 1 ? "" : "s"}
													</Badge>
													{connection.hasWebhookSecret && (
														<Badge variant="outline">Webhook enabled</Badge>
													)}
													{connection.repositories.slice(0, 4).map((repo) => (
														<Badge key={repo} variant="outline">
															{repo}
														</Badge>
													))}
													{connection.repositories.length > 4 && (
														<Badge variant="outline">
															+{connection.repositories.length - 4} more
														</Badge>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</PageShell>

			<SandboxAddGitHubConnection
				isOpen={isConnectionModalOpen}
				onClose={() => setIsConnectionModalOpen(false)}
				form={form}
				setForm={setForm}
			/>
		</>
	);
}
