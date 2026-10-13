import { policyRulesSchema, type PolicyRule } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function usePolicyDraft(initial: PolicyRule[]) {
  const [draft, setDraft] = useState(() => initial.map((rule) => ({ key: generateId(), rule })));
  const parsed = policyRulesSchema.safeParse(draft.map((entry) => entry.rule));
  const update = (key: string, rule: PolicyRule) =>
    setDraft((rules) => rules.map((entry) => (entry.key === key ? { ...entry, rule } : entry)));
  const remove = (key: string) => setDraft((rules) => rules.filter((entry) => entry.key !== key));
  const add = () =>
    setDraft((rules) => {
      const id = Array.from({ length: 51 }, (_, index) => `rule-${index + 1}`).find(
        (candidate) => !rules.some((entry) => entry.rule.id === candidate),
      );

      if (!id || rules.length >= 50) {
        return rules;
      }

      return [
        ...rules,
        {
          key: generateId(),
          rule: {
            id,
            effect: "review",
            when: {
              type: "cedar",
              metadataOnly: false,
              source:
                'permit(principal, action == Polychat::Action::"governance.match", resource)\nwhen { true };',
            },
          },
        },
      ];
    });

  return {
    draft,
    update,
    remove,
    add,
    rules: parsed.success ? parsed.data : null,
    error: parsed.success
      ? null
      : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
  };
}
