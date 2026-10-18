import { SidebarNavSection, sidebarNavLinkClass } from "@ngriffin_uk/polychat-component-navigation";
import { NavLink, TeammateCharacter, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  getPlacePaths,
  getTeammateGroupPath,
  useTeammateRoster,
  type RosterRow,
} from "@ngriffin_uk/polychat-library-react";
import { DEFAULT_PET_PRESET_SLUG } from "@ngriffin_uk/polychat-schemas";

import { TeammateStack } from "../Teammates/TeammateStack.js";

function rosterHref(row: RosterRow): string {
  return row.kind === "group"
    ? getTeammateGroupPath(row.conversationId)
    : `${getPlacePaths("chat").teammates}/${encodeURIComponent(row.teammate.id)}`;
}

function RosterLink({ row, onNavigate }: { row: RosterRow; onNavigate?: () => void }) {
  const name = row.kind === "group" ? row.name : row.teammate.name;

  return (
    <NavLink
      href={rosterHref(row)}
      className={sidebarNavLinkClass}
      onClick={onNavigate}
      title={`${name}: ${row.status}`}
    >
      {row.kind === "group" ? (
        <TeammateStack members={row.members} size={18} />
      ) : (
        <TeammateCharacter
          characterId={row.teammate.character_id ?? DEFAULT_PET_PRESET_SLUG}
          teammateId={row.teammate.id}
          name={row.teammate.name}
          size={22}
        />
      )}
      <span
        className={cn("min-w-0 flex-1 truncate", row.unread && "font-semibold text-foreground")}
      >
        {name}
      </span>
      {row.urgency === "needs_you" ? (
        <span className="size-2 shrink-0 rounded-full bg-attention" aria-label="Needs you" />
      ) : null}
    </NavLink>
  );
}

export function TeammateRosterSection({ onNavigate }: { onNavigate?: () => void }) {
  const roster = useTeammateRoster();

  if (roster.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <SidebarNavSection title="Teammates">
        {roster.map((row) => (
          <RosterLink key={row.conversationId} row={row} onNavigate={onNavigate} />
        ))}
      </SidebarNavSection>
    </div>
  );
}
