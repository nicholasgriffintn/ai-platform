import {
	WorkspaceAuditList,
	WorkspaceTemplateList,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "~/components/Core/PageShell";
import { Card, ConfirmationDialog, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
	useTemplateMutations,
	useWorkspaceAudit,
	useWorkspaceTemplates,
} from "~/hooks/useGovernance";
import { useWorkData } from "./WorkContext";

export function WorkspaceGovernance({ workspaceId }: { workspaceId: string }) {
	const navigate = useNavigate();
	const [templateIdToDelete, setTemplateIdToDelete] = useState<string | null>(null);
	const { workspaceQuery } = useWorkData();
	const canManage = workspaceQuery.data?.role === "owner" || workspaceQuery.data?.role === "admin";
	const templates = useWorkspaceTemplates(workspaceId, canManage);
	const audit = useWorkspaceAudit(workspaceId, canManage);
	const mutations = useTemplateMutations(workspaceId);
	const projectTemplates = templates.data?.filter((template) => template.kind === "project") ?? [];

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
					<WorkspaceTemplateList
						templates={projectTemplates}
						isLoading={templates.isLoading}
						errorMessage={templates.error?.message}
						instantiatingTemplateId={
							mutations.instantiate.isPending ? mutations.instantiate.variables : null
						}
						onUse={async (templateId) => {
							const project = await mutations.instantiate.mutateAsync(templateId);
							toast.success("Project created from template");
							navigate(`/work/${workspaceId}/projects/${project.id}`);
						}}
						onDelete={setTemplateIdToDelete}
					/>

					<WorkspaceAuditList
						records={audit.data ?? []}
						isLoading={audit.isLoading}
						errorMessage={audit.error?.message}
					/>
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
