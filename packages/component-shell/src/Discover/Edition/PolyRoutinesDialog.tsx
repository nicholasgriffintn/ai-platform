import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import type { usePolyRoutines } from "@ngriffin_uk/polychat-library-react";
import type { PolyRoutine } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, readLocalTimeZone } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

type RoutineActions = Pick<ReturnType<typeof usePolyRoutines>, "setup" | "remove">;

function approvalCopy(channels: readonly string[]): string {
  return channels.length > 0
    ? `Poly asks on ${channels.join(" and ")}. Reply with the code it sends to approve or reject.`
    : "Connect Slack or Telegram to Poly to approve from there. Until then, approvals wait in Polychat.";
}

function RoutineRow({
  routine,
  smsTarget,
  setup,
  remove,
}: RoutineActions & { routine: PolyRoutine; smsTarget: string }) {
  const [time, setTime] = useState(routine.time);
  const isOn = Boolean(routine.installation_id);
  const isBusy = setup.isPending || remove.isPending;

  const turnOn = (at: string) =>
    setup.mutate(
      {
        template_id: routine.id,
        time: at,
        timezone: readLocalTimeZone(),
        ...(smsTarget.trim() ? { sms_target: smsTarget.trim() } : {}),
      },
      {
        onSuccess: (result) => {
          if (!result.ready) {
            toast.info(
              `Connect ${result.missing_connections.join(" or ")} so this routine can run.`,
            );
          }
        },
        onError: (error) => toast.error(getErrorMessage(error, "Could not turn on this routine")),
      },
    );

  return (
    <li className="flex items-start gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">{routine.title}</p>
        <p className="text-sm text-muted-foreground">{routine.summary}</p>
        <p className="text-xs text-muted-foreground">{routine.bounds}</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {routine.cadence} at
          <Input
            type="time"
            className="h-7 w-28"
            value={time}
            disabled={isBusy}
            onChange={(event) => setTime(event.target.value)}
            onBlur={() => {
              if (isOn && time && time !== routine.time) {
                turnOn(time);
              }
            }}
          />
        </label>
      </div>
      <Switch
        aria-label={`${routine.title} routine`}
        checked={isOn}
        disabled={isBusy}
        onChange={(event) => {
          if (event.target.checked) {
            turnOn(time);

            return;
          }

          remove.mutate(routine.id, {
            onError: (error) =>
              toast.error(getErrorMessage(error, "Could not turn off this routine")),
          });
        }}
      />
    </li>
  );
}

export function PolyRoutinesDialog({
  open,
  onOpenChange,
  routines,
  approvalChannels,
  setup,
  remove,
}: RoutineActions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routines: readonly PolyRoutine[];
  approvalChannels: readonly string[];
}) {
  const [smsTarget, setSmsTarget] = useState(
    routines.find((routine) => routine.sms_target)?.sms_target ?? "",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Poly's routines</DialogTitle>
          <DialogDescription>{approvalCopy(approvalChannels)}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {routines.map((routine) => (
            <RoutineRow
              key={routine.id}
              routine={routine}
              smsTarget={smsTarget}
              setup={setup}
              remove={remove}
            />
          ))}
        </ul>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span aria-hidden>Also text approvals to</span>
          <Input
            type="tel"
            aria-label="Also text approvals to"
            placeholder="A number your SMS provider allows"
            value={smsTarget}
            onChange={(event) => setSmsTarget(event.target.value)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
