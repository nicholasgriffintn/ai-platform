import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProjectCapability, ProjectToolDefinition } from "@assistant/schemas";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	FormInput,
	Textarea,
} from "~/components/ui";
import {
	parseProjectToolConfiguration,
	type ProjectToolConfiguration,
} from "~/lib/project-tool-configuration";
import { generateId } from "~/lib/utils";

interface McpServerRow {
	id: string;
	label: string;
	url: string;
}

interface ProjectToolConfigurationDialogProps {
	capability?: ProjectCapability;
	isLoading: boolean;
	onClose: () => void;
	onSubmit: (configuration: ProjectToolConfiguration) => Promise<void>;
	tool: ProjectToolDefinition | null;
}

export function ProjectToolConfigurationDialog({
	capability,
	isLoading,
	onClose,
	onSubmit,
	tool,
}: ProjectToolConfigurationDialogProps) {
	const [vectorStoreIds, setVectorStoreIds] = useState("");
	const [servers, setServers] = useState<McpServerRow[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!tool) return;
		const configuration = parseProjectToolConfiguration(tool, capability?.configuration ?? {});
		setVectorStoreIds(
			configuration && "vectorStoreIds" in configuration
				? configuration.vectorStoreIds.join("\n")
				: "",
		);
		setServers(
			configuration && "servers" in configuration
				? configuration.servers.map((server) => ({ ...server, id: generateId() }))
				: [{ id: generateId(), label: "", url: "" }],
		);
		setError(null);
	}, [capability, tool]);

	const submit = async () => {
		if (!tool) return;
		const candidate =
			tool.configurationKind === "file_search"
				? {
						vectorStoreIds: vectorStoreIds
							.split(/[\n,]/)
							.map((value) => value.trim())
							.filter(Boolean),
					}
				: {
						servers: servers.map(({ label, url }) => ({
							label: label.trim(),
							url: url.trim(),
						})),
					};
		const configuration = parseProjectToolConfiguration(tool, candidate);
		if (!configuration) {
			setError(`Complete the required ${tool.label} configuration.`);
			return;
		}
		try {
			await onSubmit(configuration);
		} catch {
			// The project mutation exposes its API error beside the capability catalogue.
		}
	};

	return (
		<Dialog open={Boolean(tool)} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Configure {tool?.label}</DialogTitle>
					<DialogDescription>{tool?.description}</DialogDescription>
				</DialogHeader>

				{tool?.configurationKind === "file_search" ? (
					<div className="space-y-2">
						<label htmlFor="project-vector-store-ids" className="text-sm font-medium">
							Vector store IDs
						</label>
						<Textarea
							id="project-vector-store-ids"
							value={vectorStoreIds}
							onChange={(event) => setVectorStoreIds(event.target.value)}
							placeholder="vs_abc123"
							rows={4}
						/>
						<p className="text-xs text-zinc-500">Enter one ID per line.</p>
					</div>
				) : (
					<div className="space-y-3">
						{servers.map((server) => (
							<div
								key={server.id}
								className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_2fr_auto]"
							>
								<FormInput
									label="Label"
									value={server.label}
									onChange={(event) =>
										setServers((current) =>
											current.map((item) =>
												item.id === server.id ? { ...item, label: event.target.value } : item,
											),
										)
									}
								/>
								<FormInput
									label="Server URL"
									type="url"
									value={server.url}
									onChange={(event) =>
										setServers((current) =>
											current.map((item) =>
												item.id === server.id ? { ...item, url: event.target.value } : item,
											),
										)
									}
								/>
								<Button
									aria-label={`Remove ${server.label || "MCP server"}`}
									className="self-end"
									variant="outline"
									icon={<Trash2 className="h-4 w-4" />}
									disabled={servers.length === 1}
									onClick={() =>
										setServers((current) => current.filter((item) => item.id !== server.id))
									}
								/>
							</div>
						))}
						<Button
							variant="secondary"
							icon={<Plus className="h-4 w-4" />}
							onClick={() =>
								setServers((current) => [...current, { id: generateId(), label: "", url: "" }])
							}
						>
							Add server
						</Button>
					</div>
				)}

				{error && (
					<p role="alert" className="text-sm text-red-700 dark:text-red-400">
						{error}
					</p>
				)}
				<DialogFooter>
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" isLoading={isLoading} onClick={() => void submit()}>
						Save configuration
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
