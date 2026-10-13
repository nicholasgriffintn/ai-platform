import { Button, Input, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { POLICY_EFFECTS, type PolicyRule } from "@ngriffin_uk/polychat-schemas";

export function PolicyRuleEditor({
  rule,
  onChange,
  onRemove,
}: {
  rule: PolicyRule;
  onChange: (rule: PolicyRule) => void;
  onRemove: () => void;
}) {
  const condition = rule.when;

  if (condition.type !== "cedar") {
    return <p className="text-sm text-failure">Reload this policy to edit its Cedar source.</p>;
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Rule ID"
          value={rule.id}
          onChange={(event) => onChange({ ...rule, id: event.target.value })}
          className="font-mono text-xs"
        />
        <select
          aria-label={`Effect for ${rule.id}`}
          value={rule.effect}
          onChange={(event) => {
            const effect = POLICY_EFFECTS.find((value) => value === event.target.value);

            if (effect) {
              onChange({ ...rule, effect });
            }
          }}
          className="rounded-md border border-input bg-surface p-2 text-sm"
        >
          {POLICY_EFFECTS.map((effect) => (
            <option key={effect} value={effect}>
              {effect}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={onRemove}>
          Remove rule
        </Button>
      </div>
      <Input
        aria-label={`Description for ${rule.id}`}
        value={rule.description ?? ""}
        placeholder="Explain why this rule matters"
        onChange={(event) => onChange({ ...rule, description: event.target.value })}
      />
      <Textarea
        aria-label={`Cedar source for ${rule.id}`}
        value={condition.source}
        spellCheck={false}
        className="min-h-[100px] font-mono text-xs"
        onChange={(event) =>
          onChange({ ...rule, when: { ...condition, source: event.target.value } })
        }
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={condition.metadataOnly}
          onChange={(event) =>
            onChange({ ...rule, when: { ...condition, metadataOnly: event.target.checked } })
          }
        />
        Include in checks before inspection
      </label>
    </div>
  );
}
