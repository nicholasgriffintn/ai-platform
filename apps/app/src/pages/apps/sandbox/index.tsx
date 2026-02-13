import {
	ExternalLink,
	Hammer,
	Link2,
	Plus,
	ShieldCheck,
	Trash2,
} from "lucide-react";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Textarea,
} from "~/components/ui";
import {
	useConnectSandboxInstallation,
	useDeleteSandboxConnection,
	useSandboxConnections,
	useSandboxInstallConfig,
	useSandboxRuns,
	useUpsertSandboxConnection,
} from "~/hooks/useSandbox";
import { formatRelativeTime } from "~/lib/dates";
import { getStatusBadgeVariant } from "./utils";

interface ConnectionFormState {
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

function parseRepositories(value: string): string[] | undefined {
	const repositories = value
		.split(/[\n,]/g)
		.map((item) => item.trim())
		.filter(Boolean);

	if (!repositories.length) {
		return undefined;
	}

	return Array.from(new Set(repositories));
}

export function meta() {
	return [
		{ title: "Sandbox Worker - Polychat" },
		{
			name: "description",
			content:
				"Connect GitHub repositories and run sandboxed implementation workflows with streamed progress.",
		},
	];
}

export default function SandboxConnectionsPage() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
	const [form, setForm] = useState<ConnectionFormState>(INITIAL_FORM);
	const processedInstallationRef = useRef<string | null>(null);

	const { data: connections = [], isLoading, error } = useSandboxConnections();
	const { data: installConfig, isLoading: isInstallConfigLoading } =
		useSandboxInstallConfig();
	const {
		data: runs = [],
		isLoading: isRunsLoading,
		error: runsError,
	} = useSandboxRuns({ limit: 12 });
	const upsertConnectionMutation = useUpsertSandboxConnection();
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

	const handleSaveConnection = async () => {
		const installationId = Number(form.installationId);
		if (!Number.isFinite(installationId) || installationId <= 0) {
			toast.error("Installation ID must be a positive number");
			return;
		}
		if (!form.appId.trim() || !form.privateKey.trim()) {
			toast.error("App ID and private key are required");
			return;
		}

		try {
			await upsertConnectionMutation.mutateAsync({
				installationId,
				appId: form.appId.trim(),
				privateKey: form.privateKey.trim(),
				webhookSecret: form.webhookSecret.trim() || undefined,
				repositories: parseRepositories(form.repositories),
			});
			toast.success("GitHub connection saved");
			setForm(INITIAL_FORM);
			setIsConnectionModalOpen(false);
		} catch (mutationError) {
			toast.error(
				mutationError instanceof Error
					? mutationError.message
					: "Failed to save connection",
			);
		}
	};

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

	const openGitHubInstall = () => {
		if (!installConfig?.installUrl) {
			toast.error("GitHub install URL is not configured");
			return;
		}

		window.open(installConfig.installUrl, "_blank", "noopener");
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
								Connect your GitHub App installation and launch implementation
								runs in an isolated sandbox. Each run streams progress and
								stores output history.
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
							<CardContent>
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
										icon={<Hammer className="h-8 w-8 text-zinc-400" />}
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
															variant="ghost"
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

						<Card>
							<CardHeader>
								<CardTitle>Recent sandbox runs</CardTitle>
								<CardDescription>
									The latest execution history across your connected
									repositories.
								</CardDescription>
							</CardHeader>
							<CardContent>
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
									<div className="text-sm text-muted-foreground">
										No runs yet. Open a connection and submit your first task.
									</div>
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
					</div>
				</div>
			</PageShell>

			<Dialog
				open={isConnectionModalOpen}
				onOpenChange={setIsConnectionModalOpen}
			>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Add GitHub connection</DialogTitle>
						<DialogDescription>
							Use GitHub App installation for auto-setup, or enter credentials
							manually as fallback.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="rounded-lg border bg-muted/30 p-3">
							<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
								Recommended: install GitHub App
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Install in GitHub and return to this page. If server defaults
								are configured, we connect the installation automatically.
							</p>
							<div className="mt-3">
								<Button
									variant="secondary"
									icon={<ExternalLink className="h-4 w-4" />}
									onClick={openGitHubInstall}
									disabled={!installConfig?.installUrl}
								>
									Install GitHub App
								</Button>
							</div>
							{installConfig?.callbackUrl && (
								<p className="mt-2 text-xs text-muted-foreground">
									Setup URL: <code>{installConfig.callbackUrl}</code>
								</p>
							)}
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="sandbox-installation-id">Installation ID</Label>
								<Input
									id="sandbox-installation-id"
									type="number"
									placeholder="12345678"
									value={form.installationId}
									onChange={(event) =>
										setForm((prev) => ({
											...prev,
											installationId: event.target.value,
										}))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="sandbox-app-id">GitHub App ID</Label>
								<Input
									id="sandbox-app-id"
									placeholder="123456"
									value={form.appId}
									onChange={(event) =>
										setForm((prev) => ({
											...prev,
											appId: event.target.value,
										}))
									}
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="sandbox-private-key">
								GitHub App private key
							</Label>
							<Textarea
								id="sandbox-private-key"
								rows={6}
								placeholder="-----BEGIN PRIVATE KEY-----"
								value={form.privateKey}
								onChange={(event) =>
									setForm((prev) => ({
										...prev,
										privateKey: event.target.value,
									}))
								}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="sandbox-webhook-secret">
								Webhook secret (optional)
							</Label>
							<Input
								id="sandbox-webhook-secret"
								placeholder="Webhook signing secret"
								value={form.webhookSecret}
								onChange={(event) =>
									setForm((prev) => ({
										...prev,
										webhookSecret: event.target.value,
									}))
								}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="sandbox-repositories">
								Allowed repositories (optional)
							</Label>
							<Textarea
								id="sandbox-repositories"
								rows={3}
								placeholder="owner/repo-a, owner/repo-b"
								value={form.repositories}
								onChange={(event) =>
									setForm((prev) => ({
										...prev,
										repositories: event.target.value,
									}))
								}
							/>
							<p className="text-xs text-muted-foreground">
								Leave blank to allow this installation to run against any
								repository it can access.
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsConnectionModalOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							icon={<ShieldCheck className="h-4 w-4" />}
							onClick={handleSaveConnection}
							isLoading={upsertConnectionMutation.isPending}
						>
							Save connection
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
