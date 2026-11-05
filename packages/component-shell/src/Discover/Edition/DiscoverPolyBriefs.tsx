import { Badge, Button, NavLink } from "@ngriffin_uk/polychat-component-ui";
import { usePolyRoutines } from "@ngriffin_uk/polychat-library-react";
import type { PolyRoutineBrief } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { PolyRoutinesDialog } from "./PolyRoutinesDialog.js";

function BriefItem({ brief }: { brief: PolyRoutineBrief }) {
  const body = (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {brief.title}
        {brief.needs_you ? <Badge variant="outline">Needs you</Badge> : null}
      </span>
      <span className="text-[0.9rem] leading-snug text-foreground">{brief.summary}</span>
    </span>
  );

  return (
    <li>
      {brief.conversation_id ? (
        <NavLink
          href={`/chat/${encodeURIComponent(brief.conversation_id)}`}
          className="block no-underline hover:!no-underline hover:opacity-80"
        >
          {body}
        </NavLink>
      ) : (
        body
      )}
    </li>
  );
}

export function DiscoverPolyBriefs() {
  const routines = usePolyRoutines(true);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const briefs = routines.data?.briefs ?? [];
  const hasRoutine = routines.data?.routines.some((routine) => routine.installation_id) ?? false;

  if (!routines.data) {
    return null;
  }

  return (
    <section aria-label="Briefs from Poly" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="polychat-eyebrow">From Poly</p>
        <Button size="xs" variant="outline" onClick={() => setIsSettingUp(true)}>
          Routines
        </Button>
      </div>
      {briefs.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {briefs.map((brief) => (
            <BriefItem key={brief.id} brief={brief} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {hasRoutine
            ? "Nothing from your routines in the last day."
            : "Turn on a routine and Poly will leave its brief here."}
        </p>
      )}
      <PolyRoutinesDialog
        open={isSettingUp}
        onOpenChange={setIsSettingUp}
        routines={routines.data.routines}
        approvalChannels={routines.data.approval_channels}
        setup={routines.setup}
        remove={routines.remove}
      />
    </section>
  );
}
