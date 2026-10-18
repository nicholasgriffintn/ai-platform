import { type ToolRule, type ToolRuleLevel, withToolRule } from "@ngriffin_uk/polychat-schemas";
import { useCallback } from "react";

import { useAuthStatus } from "./useAuth.js";

const NO_RULES: ToolRule[] = [];

export function useToolRules() {
  const { userSettings, updateUserSettings, isUpdatingUserSettings } = useAuthStatus();
  const rules = userSettings?.tool_rules ?? NO_RULES;

  const setRule = useCallback(
    (toolName: string, level: ToolRuleLevel | null) =>
      updateUserSettings({ tool_rules: withToolRule(rules, toolName, level) }),
    [rules, updateUserSettings],
  );

  return { rules, setRule, isSaving: isUpdatingUserSettings };
}
