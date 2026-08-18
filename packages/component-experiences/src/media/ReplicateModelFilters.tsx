import { Button, cn, SearchInput } from "@ngriffin_uk/polychat-component-ui";

export interface ReplicateSignatureFilter {
  signature: string;
  label: string;
}

export interface ReplicateModelFiltersProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  signatureFilters: ReplicateSignatureFilter[];
  selectedSignature: string | null;
  onSelectedSignatureChange: (signature: string | null) => void;
  onViewPredictions: () => void;
}

function filterPillClass(isActive: boolean) {
  return cn(
    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
    isActive
      ? "bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 border-zinc-900 dark:border-zinc-200"
      : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
  );
}

export function ReplicateModelFilters({
  searchQuery,
  onSearchQueryChange,
  signatureFilters,
  selectedSignature,
  onSelectedSignatureChange,
  onViewPredictions,
}: ReplicateModelFiltersProps) {
  return (
    <div className="flex flex-col gap-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <SearchInput
          value={searchQuery}
          onChange={onSearchQueryChange}
          placeholder="Search Replicate models..."
          className="w-full md:max-w-md"
        />
        <Button variant="secondary" onClick={onViewPredictions}>
          View my predictions
        </Button>
      </div>

      {signatureFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectedSignatureChange(null)}
            className={filterPillClass(selectedSignature === null)}
          >
            All models
          </button>
          {signatureFilters.map(({ signature, label }) => (
            <button
              type="button"
              key={signature}
              onClick={() => onSelectedSignatureChange(signature)}
              className={filterPillClass(selectedSignature === signature)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
