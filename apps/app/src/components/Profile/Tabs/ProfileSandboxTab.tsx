import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { SandboxAddGitHubConnection } from "~/components/Models/SandboxAddGitHubConnection";
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
import {
	useConnectSandboxInstallation,
	useDeleteSandboxConnection,
	useSandboxConnections,
	useSandboxInstallConfig,
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

export function ProfileSandboxTab() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
	const [form, setForm] = useState<ConnectionFormState>(INITIAL_FORM);
	const processedInstallationRef = useRef<string | null>(null);

	const { data: connections = [], isLoading, error } = useSandboxConnections();
	const { data: installConfig, isLoading: isInstallConfigLoading } = useSandboxInstallConfig();
	const connectInstallationMutation = useConnectSandboxInstallation();
	const deleteConnectionMutation = useDeleteSandboxConnection();

	useEffect(() => {
		const rawInstallationId =
			searchParams.get("installation_id") || searchParams.get("installationId");

		if (!rawInstallationId) {
			processedInstallationRef.current = null;
			return;
		}
		if (processedInstallationRef.current === rawInstallationId) return;
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
			next.set("tab", "sandbox");
			setSearchParams(next, { replace: true });
		};

		const installationId = Number(rawInstallationId);
		if (!Number.isFinite(installationId) || installationId <= 0) {
			toast.error("GitHub installation id in callback URL is invalid");
			clearInstallParams();
			return;
		}

		if (!installConfig?.canAutoConnect) {
			toast.info("GitHub install detected. Open Add connection and save it manually.");
			clearInstallParams();
			setIsConnectionModalOpen(true);
			setForm((prev) => ({ ...prev, installationId: String(installationId) }));
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
		if (!window.confirm(`Delete the connection for installation ${installationId}?`)) return;

		try {
			await deleteConnectionMutation.mutateAsync(installationId);
			toast.success("Connection deleted");
		} catch (mutationError) {
			toast.error(
				mutationError instanceof Error ? mutationError.message : "Failed to delete connection",
			);
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader
				actions={[
					{
						label: "Add GitHub connection",
						icon: <Plus className="h-4 w-4" />,
						onClick: () => setIsConnectionModalOpen(true),
					},
				]}
			>
				<PageTitle title="Sandbox" />
				<p className="max-w-3xl text-sm text-muted-foreground">
					Connect GitHub installations used by Sandbox chat mode.
				</p>
			</PageHeader>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-3">
						<div className="rounded-lg bg-zinc-900/10 p-2 text-zinc-900 dark:text-zinc-100">
							<Link2 className="h-5 w-5" />
						</div>
						<div>
							<CardTitle>Repository connections</CardTitle>
							<CardDescription>
								{connections.length} installation{connections.length === 1 ? "" : "s"} connected.
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="text-sm text-muted-foreground">Loading connections...</div>
					) : error ? (
						<Alert variant="destructive">
							<AlertTitle>Unable to load connections</AlertTitle>
							<AlertDescription>
								{error instanceof Error ? error.message : "Unknown error"}
							</AlertDescription>
						</Alert>
					) : connections.length === 0 ? (
						<EmptyState
							icon={<ExternalLink className="h-8 w-8 text-zinc-400" />}
							title="No sandbox connections yet"
							message="Install the GitHub App or add a connection manually to start running sandbox tasks from chat."
							className="min-h-[260px]"
						/>
					) : (
						<div className="space-y-3">
							{connections.map((connection) => (
								<div key={connection.installationId} className="rounded-lg border bg-card p-4">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div className="space-y-1">
											<p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
												Installation {connection.installationId}
											</p>
											<p className="text-xs text-muted-foreground">App ID: {connection.appId}</p>
											<p className="text-xs text-muted-foreground">
												Updated {formatRelativeTime(connection.updatedAt)}
											</p>
										</div>
										<Button
											variant="destructive"
											size="sm"
											icon={<Trash2 className="h-4 w-4" />}
											onClick={() => handleDeleteConnection(connection.installationId)}
											isLoading={deleteConnectionMutation.isPending}
										>
											Remove
										</Button>
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
											<Badge variant="outline">+{connection.repositories.length - 4} more</Badge>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<SandboxAddGitHubConnection
				isOpen={isConnectionModalOpen}
				onClose={() => setIsConnectionModalOpen(false)}
				form={form}
				setForm={setForm}
			/>
		</div>
	);
}
