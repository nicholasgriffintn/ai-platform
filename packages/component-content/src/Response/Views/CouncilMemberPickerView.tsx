import { Button, Checkbox, cn } from "@ngriffin_uk/polychat-component-ui";
import { UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import type { ToolInteractionHandler } from "../registry";

const TOOL_NAME = "select_council_members";

interface CouncilMemberOption {
  id: string;
  name: string;
  role: string;
}

interface CouncilMemberPickerData {
  members?: CouncilMemberOption[];
  recommended?: string[];
  reason?: string;
  maxSelection?: number;
  resolved?: boolean;
  resolution?: {
    memberIds?: string[];
  };
}

const EMPTY_MEMBERS: CouncilMemberOption[] = [];

function isMemberOption(value: unknown): value is CouncilMemberOption {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as CouncilMemberOption).id === "string" &&
    typeof (value as CouncilMemberOption).name === "string"
  );
}

function readPickerData(data: unknown): CouncilMemberPickerData {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  const record = data as CouncilMemberPickerData;

  return {
    ...record,
    members: Array.isArray(record.members) ? record.members.filter(isMemberOption) : [],
  };
}

export function CouncilMemberPickerView({
  data,
  onToolInteraction,
}: {
  data: unknown;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const picker = useMemo(() => readPickerData(data), [data]);
  const members = picker.members ?? EMPTY_MEMBERS;
  const maxSelection = picker.maxSelection ?? 6;
  const memberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const [selected, setSelected] = useState<string[]>(() =>
    (picker.recommended ?? []).filter((id) => memberIds.has(id)).slice(0, maxSelection),
  );
  const [submittedSelection, setSubmittedSelection] = useState<string[] | null>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const atLimit = selected.length >= maxSelection;
  const persistedSelection = Array.isArray(picker.resolution?.memberIds)
    ? picker.resolution.memberIds.filter((id) => memberIds.has(id))
    : null;
  const resolvedSelection = submittedSelection ?? persistedSelection;
  const isResolved = resolvedSelection !== null || picker.resolved === true;

  if (members.length === 0) {
    return null;
  }

  const toggleMember = (memberId: string, checked: boolean) => {
    setSelected((current) => {
      if (checked) {
        return current.includes(memberId) || current.length >= maxSelection
          ? current
          : [...current, memberId];
      }

      return current.filter((id) => id !== memberId);
    });
  };

  const convene = () => {
    if (selected.length === 0 || isResolved || !onToolInteraction) {
      return;
    }

    const names = selected.map((id) => members.find((member) => member.id === id)?.name ?? id);

    setSubmittedSelection(selected);
    onToolInteraction(TOOL_NAME, "submitPrompt", {
      input: `Convene the council with these members: ${names.join(", ")}.`,
      memberIds: selected,
    });
  };

  if (isResolved) {
    const selectedMembers = resolvedSelection
      ? resolvedSelection.flatMap((id) => {
          const member = members.find((candidate) => candidate.id === id);

          return member ? [member] : [];
        })
      : [];

    return (
      <section className="space-y-2" aria-label="Council convened">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <UsersRound className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Council convened</span>
        </div>
        {selectedMembers.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Selected council members">
            {selectedMembers.map((member) => (
              <li
                key={member.id}
                className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-foreground"
              >
                {member.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">The selected members have been submitted.</p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <UsersRound className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Choose the council</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {selected.length}/{maxSelection}
        </span>
      </div>

      {picker.reason && <p className="text-xs text-muted-foreground">{picker.reason}</p>}

      <fieldset
        disabled={isResolved}
        className="grid grid-cols-1 gap-2 disabled:opacity-60 sm:grid-cols-2"
      >
        <legend className="sr-only">Council members</legend>
        {members.map((member) => {
          const isSelected = selectedSet.has(member.id);
          const isBlocked = !isSelected && atLimit;

          return (
            <label
              key={member.id}
              className={cn(
                "flex items-start gap-2 rounded-md border border-border p-2 text-left transition-colors",
                isSelected
                  ? "bg-surface-elevated text-foreground"
                  : "bg-transparent text-foreground",
                isResolved || isBlocked
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:bg-surface-elevated",
              )}
            >
              <Checkbox
                checked={isSelected}
                disabled={isResolved || isBlocked}
                onCheckedChange={(checked) => toggleMember(member.id, checked === true)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-5">{member.name}</span>
                {member.role && (
                  <span className="block text-xs leading-4 text-muted-foreground">
                    {member.role}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {selected.length === 0
            ? "Pick at least one member."
            : "Members debate in the order the chamber decides."}
        </span>
        <Button size="xs" onClick={convene} disabled={isResolved || selected.length === 0}>
          Convene
        </Button>
      </div>
    </div>
  );
}
