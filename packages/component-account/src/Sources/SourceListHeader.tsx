import { FormSelect } from "@ngriffin_uk/polychat-component-ui";

export interface SourceKindOption {
  value: string;
  label: string;
}

export interface SourceListHeaderProps {
  collectionTitle?: string;
  kindOptions: SourceKindOption[];
  kind: string;
  onKindChange: (kind: string) => void;
  showKindFilter?: boolean;
}

export function SourceListHeader({
  collectionTitle,
  kindOptions,
  kind,
  onKindChange,
  showKindFilter = true,
}: SourceListHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">{collectionTitle ?? "All sources"}</h2>
        <p className="text-sm text-zinc-500">
          {collectionTitle
            ? "Sources grouped in this collection."
            : "Browse and manage available source material."}
        </p>
      </div>
      {showKindFilter ? (
        <FormSelect
          aria-label="Filter sources by type"
          fullWidth={false}
          value={kind}
          onChange={(event) => onKindChange(event.target.value)}
          options={kindOptions}
        />
      ) : null}
    </div>
  );
}
