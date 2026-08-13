import { ClipboardList, LayoutTemplate, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageShell } from "~/components/Core/PageShell";
import { Button, Card, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import {
	useTemplateMutations,
	useWorkspaceAudit,
	useWorkspaceTemplates,
} from "~/hooks/useGovernance";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { useWorkData } from "./WorkContext";

export function WorkspaceGovernance({ workspaceId }: { workspaceId: string }) {
	const navigate = useNavigate();
	const [templateIdToDelete, setTemplateIdToDelete] = useState<string | null>(null);
	const { workspaceQuery } = useWorkData();
	const canManage = workspaceQuery.data?.role === "owner" || workspaceQuery.data?.role === "admin";
	const templates = useWorkspaceTemplates(workspaceId, canManage);
	const audit = useWorkspaceAudit(workspaceId, canManage);
	const mutations = useTemplateMutations(workspaceId);
	const projectTemplates = templates.data?.filter((template) => template.kind === "project");

	return (
		<PageShell.Content className="max-w-6xl">
			<PageShell.Header title="Governance" />
			<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
				Manage reusable project templates and review workspace changes.
			</p>

			{workspaceQuery.isLoading ? (
				<Card className="p-6 text-sm text-zinc-500 shadow-none">Loading governance…</Card>
			) : !canManage ? (
				<EmptyState
					title="Governance unavailable"
					message="Workspace administrators manage templates and audit history."
					className="min-h-[240px]"
				/>
			) : (
				<div className="grid gap-8 lg:grid-cols-2">
					<section>
						<div className="mb-3">
							<h2 className="flex items-center gap-2 text-lg font-semibold">
								<LayoutTemplate size={18} className="text-zinc-500" /> Project templates
							</h2>
							<p className="text-sm text-zinc-500">Create projects from saved configurations.</p>
						</div>
						{templates.error ? (
							<EmptyState title="Templates unavailable" message={templates.error.message} />
						) : templates.isLoading ? (
							<Card className="p-6 text-sm text-zinc-500 shadow-none">Loading templates…</Card>
						) : !projectTemplates?.length ? (
							<EmptyState
								title="No project templates"
								message="Save a project as a template from its overview."
								className="min-h-[180px]"
							/>
						) : (
							<Card className="gap-0 overflow-hidden py-0 shadow-none">
								{projectTemplates.map((template) => (
									<div
										key={template.id}
										className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
									>
										<div className="min-w-0 flex-1">
											<h3 className="truncate text-sm font-medium">{template.name}</h3>
											<p className="truncate text-xs text-zinc-500">
												{template.description || "Reusable project setup"}
											</p>
										</div>
										<Button
											size="sm"
											variant="outline"
											icon={<Play size={14} />}
											isLoading={
												mutations.instantiate.isPending &&
												mutations.instantiate.variables === template.id
											}
											onClick={async () => {
												const project = await mutations.instantiate.mutateAsync(template.id);
												toast.success("Project created from template");
												navigate(`/work/${workspaceId}/projects/${project.id}`);
											}}
										>
											Use
										</Button>
										<Button
											size="sm"
											variant="ghost"
											icon={<Trash2 size={14} />}
											onClick={() => setTemplateIdToDelete(template.id)}
										>
											Delete
										</Button>
									</div>
								))}
							</Card>
						)}
					</section>

					<section>
						<div className="mb-3">
							<h2 className="flex items-center gap-2 text-lg font-semibold">
								<ClipboardList size={18} className="text-zinc-500" /> Audit history
							</h2>
							<p className="text-sm text-zinc-500">Review governed changes in this workspace.</p>
						</div>
						{audit.error ? (
							<EmptyState title="Audit history unavailable" message={audit.error.message} />
						) : audit.isLoading ? (
							<Card className="p-6 text-sm text-zinc-500 shadow-none">Loading audit history…</Card>
						) : !audit.data?.length ? (
							<EmptyState
								title="No audit history"
								message="Governed workspace changes will appear here."
								className="min-h-[180px]"
							/>
						) : (
							<Card className="gap-0 overflow-hidden py-0 shadow-none">
								{audit.data.map((record) => (
									<div
										key={record.id}
										className="border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
									>
										<p className="text-sm font-medium capitalize">
											{record.action.replaceAll(".", " ")}
										</p>
										<p className="mt-1 text-xs text-zinc-500">
											<span className="capitalize">{record.targetType}</span>
											{record.targetId ? ` · ${record.targetId}` : ""} ·{" "}
											{formatDate(record.createdAt)}
										</p>
									</div>
								))}
							</Card>
						)}
					</section>
				</div>
			)}

			<ConfirmationDialog
				open={templateIdToDelete !== null}
				onOpenChange={(open) => !open && setTemplateIdToDelete(null)}
				title="Delete project template"
				description="Delete this reusable project template? Existing projects are not affected."
				confirmText="Delete template"
				variant="destructive"
				isLoading={mutations.remove.isPending}
				onConfirm={async () => {
					if (templateIdToDelete) await mutations.remove.mutateAsync(templateIdToDelete);
					setTemplateIdToDelete(null);
				}}
			/>
		</PageShell.Content>
	);
}
