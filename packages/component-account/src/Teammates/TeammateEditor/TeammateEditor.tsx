import { Alert, AlertDescription, AlertTitle, Button } from "@ngriffin_uk/polychat-component-ui";
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { AccessSection } from "./AccessSection";
import { BehaviourSection } from "./BehaviourSection";
import { CapabilitiesSection } from "./CapabilitiesSection";
import { ConnectionsSection } from "./ConnectionsSection";
import { IdentitySection } from "./IdentitySection";
import { ModelSection } from "./ModelSection";
import {
  createTeammateEditorValue,
  toTeammateFormData,
  validateTeammateEditorValue,
} from "./teammate-editor-value";
import type { TeammateEditorChange, TeammateEditorProps } from "./types";

export function TeammateEditor({
  teammate,
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
}: TeammateEditorProps) {
  const [value, setValue] = useState(() => createTeammateEditorValue(teammate, models));
  const [validationError, setValidationError] = useState<string | null>(null);

  const change: TeammateEditorChange = (patch) => {
    setValue((current) => ({ ...current, ...patch }));
  };

  const disabled = !canManage || isSaving;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const issue = validateTeammateEditorValue(value);

    setValidationError(issue);

    if (issue) {
      return;
    }

    onSubmit(toTeammateFormData(value));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!canManage && (
        <Alert variant="info">
          <AlertTitle>Read only</AlertTitle>
          <AlertDescription>
            {cannotManageReason ?? "You do not have permission to change this teammate."}
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
        ownerScopeType={teammate?.owner_scope_type ?? "user"}
        ownerLabel={ownerLabel}
        isSaved={teammate !== null}
        publish={canManage ? publish : undefined}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          {teammate && canManage && onDelete && (
            <Button type="button" variant="destructive" onClick={onDelete}>
              Delete teammate
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
              {teammate ? "Save teammate" : "Create teammate"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
