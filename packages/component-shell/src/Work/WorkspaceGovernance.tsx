import { Card, ConfirmationDialog, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  ProjectStarterList,
  WorkspaceAuditList,
  WorkspaceTemplateList,
} from "@ngriffin_uk/polychat-component-workspaces";
import {
  useProjectStarters,
  useTemplateMutations,
  useWorkspaceAudit,
  useWorkspaceTemplates,
} from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "../Shell/PageShell.js";
import { useWorkData } from "./WorkDataContext.js";
import { WorkspaceUsage } from "./WorkspaceUsage.js";

export function WorkspaceGovernance({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const [templateIdToDelete, setTemplateIdToDelete] = useState<string | null>(null);
  const { workspaceQuery } = useWorkData();
  const canManage = workspaceQuery.data?.role === "owner" || workspaceQuery.data?.role === "admin";
  const templates = useWorkspaceTemplates(workspaceId, canManage);
  const audit = useWorkspaceAudit(workspaceId, canManage);
  const starters = useProjectStarters(canManage);
  const mutations = useTemplateMutations(workspaceId);
  const projectTemplates = templates.data?.filter((template) => template.kind === "project") ?? [];

  return (
    <PageShell.Content className="max-w-6xl">
      <PageShell.Header title="Governance" />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Review workspace spend, start a project from a starter, manage reusable project templates,
        and review workspace changes.
      </p>

      {workspaceQuery.isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground shadow-none">Loading governance…</Card>
      ) : !canManage ? (
        <EmptyState
          title="Governance unavailable"
          message="Workspace administrators manage templates and audit history."
          className="min-h-[240px]"
        />
      ) : (
        <>
          <WorkspaceUsage
            key={workspaceId}
            workspaceId={workspaceId}
            projects={workspaceQuery.data?.projects ?? []}
          />
          <div className="grid gap-8 lg:grid-cols-2">
            <ProjectStarterList
              starters={starters.data ?? []}
              isLoading={starters.isLoading}
              errorMessage={starters.error?.message}
              startingSlug={
                mutations.startFromStarter.isPending ? mutations.startFromStarter.variables : null
              }
              onStart={async (starterSlug) => {
                const project = await mutations.startFromStarter.mutateAsync(starterSlug);

                toast.success("Project created, teammates hired");
                void navigate(`/work/${workspaceId}/projects/${project.id}`);
              }}
            />

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
                void navigate(`/work/${workspaceId}/projects/${project.id}`);
              }}
              onDelete={setTemplateIdToDelete}
            />

            <WorkspaceAuditList
              records={audit.data ?? []}
              isLoading={audit.isLoading}
              errorMessage={audit.error?.message}
            />
          </div>
        </>
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
          if (templateIdToDelete) {
            await mutations.remove.mutateAsync(templateIdToDelete);
          }

          setTemplateIdToDelete(null);
        }}
      />
    </PageShell.Content>
  );
}
