import {
  Button,
  ButtonLink,
  OptionsMenu,
  OptionsMenuRadioGroup,
  SearchInput,
} from "@ngriffin_uk/polychat-component-ui";
import {
  FILES_FILTERS,
  type FilesFilter,
  getFilesFilterPath,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { ArrowUpDown, LayoutGrid, List, ListFilter } from "lucide-react";

import { FILE_TYPE_LABELS, type FileType } from "./file-items.js";

const FILTER_LABELS: Record<FilesFilter, string> = {
  all: "All",
  made: "Made",
  sources: "Sources",
  memory: "Memory",
};

const SORT_OPTIONS = [
  { value: "recent", label: "Recently updated" },
  { value: "name", label: "Name" },
] as const;

const ANY_TYPE = "any";

export function FilesToolbar({
  basePath,
  filter,
  query,
  onQueryChange,
  onQuerySubmit,
  searchPlaceholder,
  types,
  type,
  onTypeChange,
}: {
  basePath: string;
  filter?: FilesFilter;
  query: string;
  onQueryChange: (query: string) => void;
  onQuerySubmit?: (query: string) => void;
  searchPlaceholder: string;
  types: FileType[];
  type: FileType | null;
  onTypeChange: (type: FileType | null) => void;
}) {
  const layout = useUIStore((state) => state.filesLayout);
  const setLayout = useUIStore((state) => state.setFilesLayout);
  const sort = useUIStore((state) => state.filesSort);
  const setSort = useUIStore((state) => state.setFilesSort);
  const typeOptions = [
    { value: ANY_TYPE, label: "Any type" },
    ...types.map((value) => ({ value, label: FILE_TYPE_LABELS[value] })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filter ? (
        <nav aria-label="Files filters" className="w-full sm:mr-auto sm:w-auto">
          <ul className="flex flex-wrap gap-1">
            {FILES_FILTERS.map((candidate) => (
              <li key={candidate}>
                <ButtonLink
                  href={getFilesFilterPath(basePath, candidate)}
                  variant={candidate === filter ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  aria-current={candidate === filter ? "page" : undefined}
                >
                  {FILTER_LABELS[candidate]}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <span className="hidden sm:mr-auto sm:block" />
      )}
      <form
        className="min-w-0 flex-1 sm:w-64 sm:flex-none"
        onSubmit={(event) => {
          event.preventDefault();
          onQuerySubmit?.(query.trim());
        }}
      >
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder={searchPlaceholder}
          aria-label="Search files"
        />
      </form>
      <div className="flex items-center gap-1">
        {types.length > 1 ? (
          <OptionsMenu
            align="end"
            trigger={
              <Button
                variant={type ? "secondary" : "icon"}
                size="icon"
                icon={<ListFilter size={16} />}
                aria-label={type ? `Showing ${FILE_TYPE_LABELS[type]}` : "Filter by type"}
              />
            }
          >
            <OptionsMenuRadioGroup
              value={type ?? ANY_TYPE}
              options={typeOptions}
              onChange={(value) =>
                onTypeChange(types.find((candidate) => candidate === value) ?? null)
              }
            />
          </OptionsMenu>
        ) : null}
        <OptionsMenu
          align="end"
          trigger={
            <Button
              variant="icon"
              size="icon"
              icon={<ArrowUpDown size={16} />}
              aria-label="Sort files"
            />
          }
        >
          <OptionsMenuRadioGroup value={sort} options={SORT_OPTIONS} onChange={setSort} />
        </OptionsMenu>
        <div className="flex items-center rounded-lg border border-border p-0.5">
          {(
            [
              { value: "grid", label: "Grid", Icon: LayoutGrid },
              { value: "list", label: "List", Icon: List },
            ] as const
          ).map(({ value, label, Icon }) => (
            <Button
              key={value}
              variant={layout === value ? "secondary" : "icon"}
              size="xs"
              icon={<Icon size={15} />}
              aria-label={`${label} view`}
              aria-pressed={layout === value}
              onClick={() => setLayout(value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
