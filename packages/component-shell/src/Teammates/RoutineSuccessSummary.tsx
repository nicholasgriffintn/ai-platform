import { useRoutineSuccess } from "@ngriffin_uk/polychat-library-react";

export function RoutineSuccessSummary({
  routineId,
  label = "Last four weeks",
}: {
  routineId: string;
  label?: string;
}) {
  const { data: routine } = useRoutineSuccess(routineId);

  if (!routine) {
    return null;
  }

  const parts = [
    `${routine.verified} of ${routine.runs} runs verified`,
    routine.unverified > 0 ? `${routine.unverified} unverified` : null,
    routine.failed > 0 ? `${routine.failed} failed` : null,
    routine.falseCompletions > 0 ? `${routine.falseCompletions} sent back` : null,
  ].filter(Boolean);

  return (
    <p className="text-xs text-muted-foreground">
      {label}: {Math.round(routine.successRate * 100)}% · {parts.join(" · ")}
    </p>
  );
}
