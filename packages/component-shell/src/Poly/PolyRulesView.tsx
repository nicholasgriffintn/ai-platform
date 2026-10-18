import { Button, FormSelect, Switch } from "@ngriffin_uk/polychat-component-ui";
import {
  buildPolyPauseOptions,
  useSetPolyLookAround,
  useSetPolyPause,
  useSetPolyToolRules,
  useTools,
} from "@ngriffin_uk/polychat-library-react";
import {
  TEAMMATE_TOOL_RULE_LEVELS,
  type PolyAgenda,
  type TeammateToolRule,
  type TeammateToolRuleLevel,
} from "@ngriffin_uk/polychat-schemas";
import { formatClockTime, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { PolyAutonomySection } from "./PolyAutonomySection.js";

const LEVEL_LABELS: Readonly<Record<TeammateToolRuleLevel, string>> = {
  act: "Just do it",
  act_if_asked: "Do it when I asked",
  ask: "Ask me first",
  hand_off: "Leave it to me",
};

const LEVEL_OPTIONS = TEAMMATE_TOOL_RULE_LEVELS.map((level) => ({
  value: level,
  label: LEVEL_LABELS[level],
}));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-border pb-4 last:border-b-0">
      <h3 className="polychat-eyebrow">{title}</h3>
      {children}
    </section>
  );
}

export function PolyRulesView({ agenda }: { agenda: PolyAgenda }) {
  const setRules = useSetPolyToolRules(agenda);
  const setPause = useSetPolyPause(agenda);
  const setLookAround = useSetPolyLookAround();
  const { data: tools = [] } = useTools();
  const [newTool, setNewTool] = useState("");
  const [newLevel, setNewLevel] = useState<TeammateToolRuleLevel>("ask");
  const [pauseOptions] = useState(() => buildPolyPauseOptions(new Date()));
  const ruled = new Set(agenda.tool_rules.map((rule) => rule.toolName));
  const toolOptions = tools
    .filter((tool) => !ruled.has(tool.id))
    .map((tool) => ({ value: tool.id, label: tool.name }));

  const saveRules = (rules: TeammateToolRule[], success: string) =>
    setRules.mutate(rules, {
      onSuccess: () => toast.success(success),
      onError: (error) => toast.error(getErrorMessage(error, "Poly could not take that rule")),
    });

  const pause = (until: string | null) =>
    setPause.mutate(until, {
      onError: (error) => toast.error(getErrorMessage(error, "Poly could not change its pause")),
    });

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <Section title="Autonomy">
        <PolyAutonomySection agenda={agenda} />
      </Section>

      <Section title="Pause">
        {agenda.paused_until ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-foreground">
              Paused until {formatClockTime(agenda.paused_until)}. Routines wait and only urgent
              things reach you.
            </p>
            <Button
              size="sm"
              variant="outline"
              isLoading={setPause.isPending}
              onClick={() => pause(null)}
            >
              Resume now
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Hold Poly&apos;s routines and keep everything but urgent things quiet.
            </p>
            <div className="flex flex-wrap gap-2">
              {pauseOptions.map((option) => (
                <Button
                  key={option.id}
                  size="sm"
                  variant="outline"
                  disabled={setPause.isPending}
                  onClick={() => pause(option.until)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Look around">
        <Switch
          label="Take a read-only look each morning"
          description="Poly reads your connected sources once a day and notes what you should know. It never sends, changes or deletes anything on these runs."
          checked={agenda.look_around.enabled}
          disabled={setLookAround.isPending}
          onChange={(event) =>
            setLookAround.mutate(event.target.checked, {
              onError: (error) =>
                toast.error(getErrorMessage(error, "Poly could not change its morning look")),
            })
          }
        />
      </Section>

      <Section title="Rules for tools">
        <p className="text-sm text-muted-foreground">
          Set how Poly treats a tool, on top of its autonomy. Sending, spending, deleting,
          credentials and exports always ask.
        </p>
        {agenda.tool_rules.length > 0 ? (
          <ul className="space-y-2">
            {agenda.tool_rules.map((rule) => (
              <li key={rule.toolName} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{rule.toolName}</span>
                <FormSelect
                  aria-label={`Rule for ${rule.toolName}`}
                  fullWidth={false}
                  value={rule.level}
                  options={LEVEL_OPTIONS}
                  disabled={setRules.isPending}
                  onValueChange={(level) =>
                    saveRules(
                      agenda.tool_rules.map((entry) =>
                        entry.toolName === rule.toolName ? { ...entry, level } : entry,
                      ),
                      `Rule for ${rule.toolName} changed`,
                    )
                  }
                />
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={setRules.isPending}
                  onClick={() =>
                    saveRules(
                      agenda.tool_rules.filter((entry) => entry.toolName !== rule.toolName),
                      `Rule for ${rule.toolName} removed`,
                    )
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
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
            disabled={!newTool || setRules.isPending}
            onClick={() => {
              saveRules(
                [...agenda.tool_rules, { toolName: newTool, level: newLevel }],
                `Rule for ${newTool} added`,
              );
              setNewTool("");
            }}
          >
            Add rule
          </Button>
        </div>
      </Section>
    </div>
  );
}
