import { FormDialog, FormInput, TeammateCharacter, cn } from "@ngriffin_uk/polychat-component-ui";
import { useTeammateGroups, useTeammates } from "@ngriffin_uk/polychat-library-react";
import {
  DEFAULT_PET_PRESET_SLUG,
  isPolyTeammateId,
  TEAMMATE_GROUP_MAX_MEMBERS,
  TEAMMATE_GROUP_MIN_MEMBERS,
  type TeammateGroup,
} from "@ngriffin_uk/polychat-schemas";
import { formatConjunctionList, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Check } from "lucide-react";
import { useState } from "react";

export function CreateTeammateGroupDialog({
  open,
  onOpenChange,
  onCreated,
  includedTeammateIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (group: TeammateGroup) => void;
  includedTeammateIds: readonly string[];
}) {
  const { teammates } = useTeammates({ enabled: open });
  const { create } = useTeammateGroups({ enabled: false });
  const [customName, setCustomName] = useState<string | null>(null);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const candidates = teammates.filter((teammate) => !isPolyTeammateId(teammate.id));
  const memberIds = [
    ...includedTeammateIds,
    ...picked.filter((id) => !includedTeammateIds.includes(id)),
  ];
  const memberNames = memberIds.flatMap((id) => {
    const member = candidates.find((teammate) => teammate.id === id);

    return member ? [member.name] : [];
  });
  const name = customName ?? formatConjunctionList(memberNames);
  const isFull = memberIds.length >= TEAMMATE_GROUP_MAX_MEMBERS;
  const needed = Math.max(0, TEAMMATE_GROUP_MIN_MEMBERS - memberIds.length);
  const canSubmit = name.trim().length > 0 && needed === 0;

  const toggle = (teammateId: string) =>
    setPicked((current) =>
      current.includes(teammateId)
        ? current.filter((id) => id !== teammateId)
        : [...current, teammateId],
    );

  const reset = () => {
    setCustomName(null);
    setPicked([]);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }

        onOpenChange(next);
      }}
      title="Add teammates"
      description="This starts a new conversation they all share. Ask one of them with @name."
      submitText="Start group"
      isLoading={create.isPending}
      submitDisabled={!canSubmit}
      onSubmit={async () => {
        const group = await create.mutateAsync({ name: name.trim(), teammateIds: memberIds });

        reset();
        onCreated(group);
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-foreground">Who is in it</legend>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hire a teammate first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {candidates.map((teammate) => {
              const isIncluded = includedTeammateIds.includes(teammate.id);
              const isSelected = memberIds.includes(teammate.id);

              return (
                <button
                  key={teammate.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isIncluded || (!isSelected && isFull)}
                  onClick={() => toggle(teammate.id)}
                  className={cn(
                    "polychat-motion-micro flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors disabled:cursor-default",
                    isSelected
                      ? "border-active-work/50 bg-active-work/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground disabled:opacity-50",
                  )}
                >
                  <TeammateCharacter
                    characterId={teammate.character_id ?? DEFAULT_PET_PRESET_SLUG}
                    teammateId={teammate.id}
                    name={teammate.name}
                    size={24}
                  />
                  <span>{teammate.name}</span>
                  {isSelected ? <Check className="size-3.5" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {needed > 0
            ? `Pick ${needed === 1 ? "one more" : `${needed} more`}.`
            : isFull
              ? `That's the most a group can hold (${TEAMMATE_GROUP_MAX_MEMBERS}).`
              : `${memberIds.length} in the group.`}
        </p>
      </fieldset>
      <FormInput
        label="Name"
        placeholder="Name the group"
        value={name}
        onChange={(event) => setCustomName(event.target.value)}
      />
      {create.error ? (
        <p role="alert" className="text-sm text-failure">
          {getErrorMessage(create.error, "Could not start that group.")}
        </p>
      ) : null}
    </FormDialog>
  );
}
