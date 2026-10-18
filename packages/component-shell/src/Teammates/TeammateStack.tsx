import { TeammateCharacter } from "@ngriffin_uk/polychat-component-ui";
import { DEFAULT_PET_PRESET_SLUG, type TeammateResponse } from "@ngriffin_uk/polychat-schemas";

const STACK_LIMIT = 3;

export function TeammateStack({
  members,
  size,
}: {
  members: readonly Pick<TeammateResponse, "id" | "name" | "character_id">[];
  size: number;
}) {
  return (
    <span className="flex shrink-0 -space-x-2" aria-hidden="true">
      {members.slice(0, STACK_LIMIT).map((member) => (
        <span key={member.id} className="rounded-full ring-2 ring-sidebar">
          <TeammateCharacter
            characterId={member.character_id ?? DEFAULT_PET_PRESET_SLUG}
            teammateId={member.id}
            name={member.name}
            size={size}
          />
        </span>
      ))}
    </span>
  );
}
