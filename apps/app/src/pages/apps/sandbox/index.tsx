import { Hammer, Link2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
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
	Input,
	Label,
	Textarea,
} from "~/components/ui";
import {
	useDeleteSandboxConnection,
	useSandboxConnections,
	useSandboxRuns,
	useUpsertSandboxConnection,
} from "~/hooks/useSandbox";
import { formatRelativeTime } from "~/lib/dates";

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
	const [form, setForm] = useState<ConnectionFormState>(INITIAL_FORM);
	const { data: connections = [], isLoading, error } = useSandboxConnections();
	const {
		data: runs = [],
		isLoading: isRunsLoading,
		error: runsError,
	} = useSandboxRuns({ limit: 12 });
	const upsertConnectionMutation = useUpsertSandboxConnection();
	const deleteConnectionMutation = useDeleteSandboxConnection();

	const totalRepositories = useMemo(() => {
		return connections.reduce(
			(total, connection) => total + connection.repositories.length,
			0,
		);
	}, [connections]);

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

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={
				<PageHeader>
					<BackLink to="/apps" label="Back to Apps" />
					<PageTitle title="Sandbox Worker" />
					<p className="text-sm text-muted-foreground max-w-3xl">
						Connect your GitHub App installation and launch implementation runs
						in an isolated sandbox. Each run streams progress and stores output
						history.
					</p>
				</PageHeader>
			}
		>
			<div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-3">
							<div className="rounded-lg bg-blue-600/10 p-2 text-blue-600 dark:text-blue-300">
								<Plus className="h-5 w-5" />
							</div>
							<div>
								<CardTitle>Add GitHub connection</CardTitle>
								<CardDescription>
									Store GitHub App credentials for sandbox execution.
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
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
						<Button
							variant="primary"
							fullWidth
							icon={<ShieldCheck className="h-4 w-4" />}
							onClick={handleSaveConnection}
							isLoading={upsertConnectionMutation.isPending}
						>
							Save connection
						</Button>
					</CardContent>
				</Card>

				<div className="space-y-6">
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
									message="Add your first GitHub App installation to start running sandbox tasks."
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
															handleDeleteConnection(connection.installationId)
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
								The latest execution history across your connected repositories.
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
													to={`/apps/sandbox/${run.installationId}`}
													className="font-medium text-zinc-900 dark:text-zinc-100 no-underline hover:text-blue-600 dark:hover:text-blue-300"
												>
													{run.repo}
												</Link>
												<Badge
													variant={
														run.status === "completed"
															? "outline"
															: run.status === "failed"
																? "destructive"
																: "secondary"
													}
												>
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
	);
}
