import { Button, Checkbox, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { TeammateEditorSection } from "./TeammateEditorSection";
import type { TeammateAccessSectionProps } from "./types";

export function AccessSection({
  ownerScopeType,
  ownerLabel,
  isSaved,
  disabled,
  workspaceDefault,
  onWorkspaceDefaultChange,
  publish,
}: TeammateAccessSectionProps) {
  const [workspaceId, setWorkspaceId] = useState("");
  const canPublish = isSaved && ownerScopeType === "user" && publish !== undefined;

  return (
    <TeammateEditorSection
      title="Access"
      description="Who owns this teammate, and therefore who can change it."
    >
      <p className="text-sm">
        {ownerScopeType === "workspace"
          ? `Owned by ${ownerLabel}. Workspace owners and admins can change it; everyone else can use it.`
          : `Owned by ${ownerLabel}. Only you can change it.`}
      </p>

      {!isSaved && (
        <p className="text-sm text-muted-foreground">
          New teammates start in your personal scope. Publish a copy to a workspace once it is
          saved.
        </p>
      )}

      {ownerScopeType === "workspace" && (
        <label
          htmlFor="teammate-workspace-default"
          className="flex items-start gap-3 rounded-lg border p-4"
        >
          <Checkbox
            id="teammate-workspace-default"
            checked={workspaceDefault}
            disabled={disabled}
            onCheckedChange={(next) => onWorkspaceDefaultChange(next === true)}
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Default for every project
            </span>
            <span className="block text-xs text-muted-foreground">
              Every project in {ownerLabel} gets this teammate without being asked.
            </span>
          </span>
        </label>
      )}

      {canPublish &&
        (publish.workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Publishing needs a workspace you own or administer.
          </p>
        ) : (
          <div className="space-y-3 rounded-lg border p-4">
            <FormSelect
              label="Publish to a workspace"
              value={workspaceId}
              options={[
                { value: "", label: "Choose a workspace" },
                ...publish.workspaces.map((workspace) => ({
                  value: workspace.id,
                  label: workspace.name,
                })),
              ]}
              description="Copies this teammate so the workspace owns it. Your original stays yours."
              onValueChange={setWorkspaceId}
            />
            {publish.error && <p className="text-sm text-destructive">{publish.error}</p>}
            <Button
              type="button"
              variant="outline"
              disabled={!workspaceId || publish.isPublishing}
              icon={publish.isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              onClick={() => publish.onPublish(workspaceId)}
            >
              Publish to workspace
            </Button>
          </div>
        ))}
    </TeammateEditorSection>
  );
}
