import { Button, Switch } from "@ngriffin_uk/polychat-component-ui";
import {
  buildPolyPauseOptions,
  useSetPolyLookAround,
  useSetPolyPause,
} from "@ngriffin_uk/polychat-library-react";
import type { PolyAgenda } from "@ngriffin_uk/polychat-schemas";
import { formatClockTime, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { ToolRulesEditor } from "../ToolRules/ToolRulesEditor.js";
import { PolyAutonomySection } from "./PolyAutonomySection.js";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-border pb-4 last:border-b-0">
      <h3 className="polychat-eyebrow">{title}</h3>
      {children}
    </section>
  );
}

export function PolyRulesView({ agenda }: { agenda: PolyAgenda }) {
  const setPause = useSetPolyPause(agenda);
  const setLookAround = useSetPolyLookAround();
  const [pauseOptions] = useState(() => buildPolyPauseOptions(new Date()));

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
        <ToolRulesEditor />
      </Section>
    </div>
  );
}
