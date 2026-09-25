import { Badge, Button, Textarea } from "@ngriffin_uk/polychat-component-ui";
import {
  policyRulesSchema,
  type ModelGovernanceEnforcement,
  type ModelPolicy,
  type PolicyDryRunResult,
  type PolicyRule,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { VerdictBadge } from "./RegistryBadges";
import { RegistryPanel } from "./RegistryPanel";

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

function parseRules(text: string): { rules: PolicyRule[] | null; error: string | null } {
  try {
    const parsed = policyRulesSchema.safeParse(JSON.parse(text));

    return parsed.success
      ? { rules: parsed.data, error: null }
      : {
          rules: null,
          error: parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        };
  } catch {
    return { rules: null, error: "Rules must be valid JSON" };
  }
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
  const [text, setText] = useState(() => JSON.stringify(policy.rules, null, 2));
  const [enforcement, setEnforcement] = useState<ModelGovernanceEnforcement>(policy.enforcement);
  const { rules, error } = parseRules(text);

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
          <Textarea
            aria-label={`${scopeLabel} rules`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-[220px] font-mono text-xs"
            spellCheck={false}
          />
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
