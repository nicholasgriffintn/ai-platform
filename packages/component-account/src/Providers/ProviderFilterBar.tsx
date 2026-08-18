import { SearchInput, Tabs, TabsList, TabsTrigger } from "@ngriffin_uk/polychat-component-ui";

export type ProviderTypeFilter = "all" | "connected" | "chat" | "messaging" | "connector";

export interface ProviderCounts {
  all: number;
  connected: number;
  chat: number;
  messaging: number;
  connector: number;
}

export interface ProviderFilterBarProps {
  counts: ProviderCounts;
  activeType: ProviderTypeFilter;
  onActiveTypeChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

const FILTERS: Array<{ value: ProviderTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "connected", label: "Connected" },
  { value: "chat", label: "Chat" },
  { value: "messaging", label: "Messaging" },
  { value: "connector", label: "Integrations" },
];

export function ProviderFilterBar({
  counts,
  activeType,
  onActiveTypeChange,
  search,
  onSearchChange,
}: ProviderFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <Tabs value={activeType} onValueChange={onActiveTypeChange}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {FILTERS.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value}>
              {filter.label} ({counts[filter.value]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <SearchInput
        aria-label="Search providers"
        placeholder="Search providers"
        value={search}
        onChange={onSearchChange}
        className="w-full xl:max-w-xs"
      />
    </div>
  );
}
