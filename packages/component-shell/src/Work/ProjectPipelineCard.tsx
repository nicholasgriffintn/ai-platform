import { Button } from "@ngriffin_uk/polychat-component-ui";
import { FlowEditorDialog } from "@ngriffin_uk/polychat-component-workspaces";
import {
  getProjectSurface,
  getTeammateSettingsPath,
  NEW_TEAMMATE_ID,
  projectTaskSkills,
  useCapabilityCatalog,
  useProjectTasks,
} from "@ngriffin_uk/polychat-library-react";
import type { ProjectCapability, ProjectFlow } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { ArrowRight, GitBranch } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SettingsSection } from "./SettingsSection.js";

export function ProjectPipelineCard({
  workspaceId,
  projectId,
  capabilities,
  canManage,
}: {
  workspaceId: string;
  projectId: string;
  capabilities: ProjectCapability[];
  canManage: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { flow, saveFlow } = useProjectTasks(projectId);
  const catalog = useCapabilityCatalog(projectId);
  const teammates = catalog.data?.teammates ?? [];
  const teammateName = (teammateId: string | null) =>
    teammateId
      ? (teammates.find((teammate) => teammate.id === teammateId)?.name ?? "A teammate")
      : "The task's owner";
  const save = async (next: ProjectFlow) => {
    try {
      await saveFlow.mutateAsync(next);
      setIsEditing(false);
      toast.success("Pipeline saved");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save the pipeline"));
    }
  };

  return (
    <SettingsSection
      id="pipeline"
      icon={<GitBranch size={16} />}
      title="Pipeline"
      description="The stages every task in this project moves through, whichever view you use. Each stage hands the work to a teammate or stops for a person to review."
      action={
        canManage ? (
          <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
            {flow?.stages.length ? "Edit pipeline" : "Build a pipeline"}
          </Button>
        ) : null
      }
    >
      {flow?.stages.length ? (
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {flow.stages.map((stage, index) => (
            <li key={stage.id} className="flex items-center gap-2">
              {index > 0 ? <ArrowRight size={14} className="text-muted-foreground" /> : null}
              <span className="rounded-lg border border-border bg-surface px-3 py-1.5">
                <span className="font-medium">{stage.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {teammateName(stage.teammateId)} ·{" "}
                  {stage.advance === "on_human_accept"
                    ? "you review"
                    : stage.advance === "on_council_ship"
                      ? "council review"
                      : "hands on"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          No pipeline. Each task runs with its owner from start to finish.
        </p>
      )}
      <FlowEditorDialog
        open={isEditing}
        flow={flow}
        teammates={teammates}
        skills={projectTaskSkills(capabilities, catalog.data?.skills)}
        capabilitiesHref={`/work/${workspaceId}/team`}
        createTeammateHref={getTeammateSettingsPath(
          getProjectSurface(workspaceId, projectId),
          NEW_TEAMMATE_ID,
        )}
        isSaving={saveFlow.isPending}
        errorMessage={saveFlow.error ? getErrorMessage(saveFlow.error, "") : undefined}
        onOpenChange={setIsEditing}
        onSave={save}
      />
    </SettingsSection>
  );
}
