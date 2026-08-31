import { Alert, AlertDescription, AlertTitle, Button } from "@ngriffin_uk/polychat-component-ui";
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { AccessSection } from "./AccessSection";
import {
  createAgentEditorValue,
  toAgentFormData,
  validateAgentEditorValue,
} from "./agent-editor-value";
import { BehaviourSection } from "./BehaviourSection";
import { CapabilitiesSection } from "./CapabilitiesSection";
import { ConnectionsSection } from "./ConnectionsSection";
import { IdentitySection } from "./IdentitySection";
import { ModelSection } from "./ModelSection";
import type { AgentEditorChange, AgentEditorProps } from "./types";

export function AgentEditor({
  agent,
  models,
  tools,
  skills,
  isLoadingCapabilities = false,
  canManage,
  cannotManageReason,
  isSaving,
  error,
  ownerLabel,
  publish,
  onSubmit,
  onCancel,
  onDelete,
}: AgentEditorProps) {
  const [value, setValue] = useState(() => createAgentEditorValue(agent, models));
  const [validationError, setValidationError] = useState<string | null>(null);

  const change: AgentEditorChange = (patch) => {
    setValue((current) => ({ ...current, ...patch }));
  };

  const disabled = !canManage || isSaving;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const issue = validateAgentEditorValue(value);

    setValidationError(issue);

    if (issue) {
      return;
    }

    onSubmit(toAgentFormData(value));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!canManage && (
        <Alert variant="info">
          <AlertTitle>Read only</AlertTitle>
          <AlertDescription>
            {cannotManageReason ?? "You do not have permission to change this agent."}
          </AlertDescription>
        </Alert>
      )}

      {(error || validationError) && (
        <Alert variant="destructive">
          <AlertDescription>{validationError ?? error}</AlertDescription>
        </Alert>
      )}

      <IdentitySection value={value} disabled={disabled} onChange={change} />
      <BehaviourSection value={value} disabled={disabled} onChange={change} />
      <ModelSection value={value} models={models} disabled={disabled} onChange={change} />
      <CapabilitiesSection
        value={value}
        tools={tools}
        skills={skills}
        isLoading={isLoadingCapabilities}
        disabled={disabled}
        onChange={change}
      />
      <ConnectionsSection value={value} disabled={disabled} onChange={change} />
      <AccessSection
        ownerScopeType={agent?.owner_scope_type ?? "user"}
        ownerLabel={ownerLabel}
        isSaved={agent !== null}
        publish={canManage ? publish : undefined}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          {agent && canManage && onDelete && (
            <Button type="button" variant="destructive" onClick={onDelete}>
              Delete agent
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            {canManage ? "Cancel" : "Back"}
          </Button>
          {canManage && (
            <Button
              type="submit"
              disabled={isSaving}
              icon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {agent ? "Save agent" : "Create agent"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
