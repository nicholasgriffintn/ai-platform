import { Button, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { useToolRules, useTools } from "@ngriffin_uk/polychat-library-react";
import { TOOL_RULE_LEVELS, type ToolRuleLevel } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

export const TOOL_RULE_LABELS: Readonly<Record<ToolRuleLevel, string>> = {
  act: "Just do it",
  act_if_asked: "Do it when I asked",
  ask: "Ask me first",
  hand_off: "Leave it to me",
};

const LEVEL_OPTIONS = TOOL_RULE_LEVELS.map((level) => ({
  value: level,
  label: TOOL_RULE_LABELS[level],
}));

export function ToolRulesEditor() {
  const { rules, setRule, isSaving } = useToolRules();
  const { data: tools = [] } = useTools();
  const [newTool, setNewTool] = useState("");
  const [newLevel, setNewLevel] = useState<ToolRuleLevel>("ask");
  const ruled = new Set(rules.map((rule) => rule.toolName));
  const toolNames = new Map(tools.map((tool) => [tool.id, tool.name]));
  const toolOptions = tools
    .filter((tool) => !ruled.has(tool.id))
    .map((tool) => ({ value: tool.id, label: tool.name }));

  const save = async (toolName: string, level: ToolRuleLevel | null, success: string) => {
    try {
      await setRule(toolName, level);
      toast.success(success);
    } catch (error) {
      toast.error(getErrorMessage(error, "That rule could not be saved"));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        These apply to everything that runs for you: chats, Poly and your teammates. Workspace
        approvals, and anything that sends, spends, deletes, handles credentials or exports, still
        ask.
      </p>
      {rules.length > 0 ? (
        <ul className="space-y-2">
          {rules.map((rule) => {
            const name = toolNames.get(rule.toolName) ?? rule.toolName;

            return (
              <li key={rule.toolName} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                <FormSelect
                  aria-label={`Rule for ${name}`}
                  fullWidth={false}
                  value={rule.level}
                  options={LEVEL_OPTIONS}
                  disabled={isSaving}
                  onValueChange={(level) =>
                    void save(rule.toolName, level, `${name}: ${TOOL_RULE_LABELS[level]}`)
                  }
                />
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => void save(rule.toolName, null, `Rule for ${name} removed`)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <FormSelect
          label="Tool"
          fullWidth={false}
          value={newTool}
          options={toolOptions}
          placeholder="Choose a tool"
          onValueChange={setNewTool}
        />
        <FormSelect
          label="Rule"
          fullWidth={false}
          value={newLevel}
          options={LEVEL_OPTIONS}
          onValueChange={setNewLevel}
        />
        <Button
          size="sm"
          disabled={!newTool || isSaving}
          onClick={() => {
            void save(
              newTool,
              newLevel,
              `${toolNames.get(newTool) ?? newTool}: ${TOOL_RULE_LABELS[newLevel]}`,
            );
            setNewTool("");
          }}
        >
          Add rule
        </Button>
      </div>
    </div>
  );
}
