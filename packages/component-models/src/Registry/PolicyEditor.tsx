import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import type {
  ModelGovernanceEnforcement,
  ModelPolicy,
  PolicyDryRunResult,
  PolicyRule,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { PolicyRuleEditor } from "./PolicyRuleEditor";
import { VerdictBadge } from "./RegistryBadges";
import { RegistryPanel } from "./RegistryPanel";
import { usePolicyDraft } from "./usePolicyDraft";

export interface PolicyEditorProps {
  policy: ModelPolicy;
  scopeLabel: string;
  canEdit: boolean;
  isSaving: boolean;
  isDryRunning: boolean;
  dryRun: PolicyDryRunResult | null;
  showEnforcement: boolean;
  onDryRun: (rules: PolicyRule[]) => void;
  onSave: (rules: PolicyRule[], enforcement: ModelGovernanceEnforcement) => void;
}

export function PolicyEditor({
  policy,
  scopeLabel,
  canEdit,
  isSaving,
  isDryRunning,
  dryRun,
  showEnforcement,
  onDryRun,
  onSave,
}: PolicyEditorProps) {
  const [enforcement, setEnforcement] = useState<ModelGovernanceEnforcement>(policy.enforcement);
  const { draft, rules, error, update, remove, add } = usePolicyDraft(policy.rules);

  return (
    <RegistryPanel>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {policy.isDefault ? "Default rules" : `Revision ${policy.revision}`}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          {policy.hash.slice(0, 12)}
        </span>
      </div>

      <ul className="space-y-1">
        {(rules ?? policy.rules).map((rule) => (
          <li key={rule.id} className="flex items-start gap-2 text-sm">
            <VerdictBadge effect={rule.effect} className="mt-0.5" />
            <div>
              <span className="font-mono text-xs">{rule.id}</span>
              {rule.description && <p className="text-muted-foreground">{rule.description}</p>}
            </div>
          </li>
        ))}
      </ul>

      {canEdit && (
        <>
          <p className="text-sm text-muted-foreground">
            Edit Cedar rules for {scopeLabel.toLowerCase()}. Preview checks the policy before
            saving.
          </p>
          {draft.map((entry) => (
            <PolicyRuleEditor
              key={entry.key}
              rule={entry.rule}
              onChange={(next) => update(entry.key, next)}
              onRemove={() => remove(entry.key)}
            />
          ))}
          <Button size="sm" variant="secondary" disabled={draft.length >= 50} onClick={add}>
            Add rule
          </Button>
          {error && <p className="text-sm text-failure">{error}</p>}
          {showEnforcement && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enforcement === "enforced"}
                onChange={(event) => setEnforcement(event.target.checked ? "enforced" : "advisory")}
              />
              Enforce in project chats: only approved routes may answer
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!rules || isDryRunning}
              onClick={() => rules && onDryRun(rules)}
            >
              {isDryRunning ? "Checking…" : "Preview changes"}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!rules || isSaving}
              onClick={() => rules && onSave(rules, enforcement)}
            >
              {isSaving ? "Saving…" : "Save revision"}
            </Button>
          </div>
          {dryRun && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              {dryRun.changes.length === 0 ? (
                <p>No verdicts change across {dryRun.evaluated} version(s).</p>
              ) : (
                <ul className="space-y-1">
                  {dryRun.changes.map((change) => (
                    <li key={change.versionId} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{change.displayName}</span>
                      <VerdictBadge effect={change.before} />
                      <span aria-hidden>→</span>
                      <VerdictBadge effect={change.after} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </RegistryPanel>
  );
}
