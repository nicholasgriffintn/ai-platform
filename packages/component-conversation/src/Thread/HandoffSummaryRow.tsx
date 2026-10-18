import { TeammateCharacter } from "@ngriffin_uk/polychat-component-ui";
import { useTeammates } from "@ngriffin_uk/polychat-library-react";
import { DEFAULT_PET_PRESET_SLUG } from "@ngriffin_uk/polychat-schemas";
import { formatConjunctionList } from "@ngriffin_uk/polychat-utility-core";
import { ChevronDown, ChevronRight } from "lucide-react";

export function HandoffSummaryRow({
  teammateIds,
  messageCount,
  expanded,
  onToggle,
}: {
  teammateIds: readonly string[];
  messageCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { teammates } = useTeammates();
  const members = teammateIds.map(
    (teammateId) => teammates.find((teammate) => teammate.id === teammateId) ?? null,
  );
  const names = members.map((member) => member?.name ?? "a teammate");

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex w-full cursor-pointer items-center justify-center gap-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="flex -space-x-1.5" aria-hidden="true">
        {members.map((member, index) =>
          member ? (
            <TeammateCharacter
              key={member.id}
              characterId={member.character_id ?? DEFAULT_PET_PRESET_SLUG}
              teammateId={member.id}
              name={member.name}
              size={18}
            />
          ) : (
            <span key={teammateIds[index]} className="size-[18px] rounded-full bg-selection" />
          ),
        )}
      </span>
      <span>
        {messageCount === 1 ? "Message" : "Messages"} from {formatConjunctionList(names)}
      </span>
      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
    </button>
  );
}
