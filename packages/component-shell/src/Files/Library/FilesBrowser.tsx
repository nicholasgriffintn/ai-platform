import { Button, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import { type FilesFilter, useUIStore } from "@ngriffin_uk/polychat-library-react";
import type { SourceCollection } from "@ngriffin_uk/polychat-schemas";
import { SearchX, TextSearch } from "lucide-react";
import { type ReactNode, useState } from "react";

import { SignInEmptyState } from "../../Account/SignInEmptyState.js";
import { arrangeFileItems, FILE_TYPE_LABELS, type FileItem, type FileType } from "./file-items.js";
import { FileCollection } from "./FileCollection.js";
import { FilesToolbar } from "./FilesToolbar.js";
import { KnowledgePassages } from "./KnowledgePassages.js";
import type { FileActions } from "./useFileActions.js";

const FILE_TYPE_ORDER = Object.keys(FILE_TYPE_LABELS) as FileType[];

export function FilesBrowser({
  basePath,
  projectId,
  filter,
  items,
  folderItems,
  folders,
  isLoading,
  error,
  actions,
  empty,
}: {
  basePath: string;
  projectId?: string;
  filter?: FilesFilter;
  items: FileItem[];
  folderItems: FileItem[];
  folders: SourceCollection[];
  isLoading: boolean;
  error: Error | null;
  actions: FileActions;
  empty: ReactNode;
}) {
  const layout = useUIStore((state) => state.filesLayout);
  const sort = useUIStore((state) => state.filesSort);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<FileType | null>(null);
  const [passageQuery, setPassageQuery] = useState("");
  const types = FILE_TYPE_ORDER.filter((candidate) =>
    items.some((item) => item.type === candidate),
  );
  const activeType = type && types.includes(type) ? type : null;
  const visibleItems = arrangeFileItems(items, { query, type: activeType, sort });
  const visibleFolders = activeType
    ? []
    : arrangeFileItems(folderItems, { query, type: null, sort });

  const content = (() => {
    if (isLoading) {
      return <CardGridLoadingSkeleton count={8} label="Loading files" />;
    }

    if (isAuthenticationError(error)) {
      return (
        <SignInEmptyState
          title="Sign in to see your files"
          message="Files are kept against your account."
        />
      );
    }

    if (error) {
      return <EmptyState title="Files unavailable" message={error.message} />;
    }

    if (!items.length && !folderItems.length) {
      return empty;
    }

    if (!visibleItems.length && !visibleFolders.length) {
      return (
        <EmptyState
          icon={<SearchX size={24} className="text-muted-foreground" />}
          title="Nothing matches"
          message="No names match. Try another word or type."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setType(null);
              }}
            >
              Clear filters
            </Button>
          }
        />
      );
    }

    return (
      <FileCollection
        items={visibleItems}
        folderItems={visibleFolders}
        layout={layout}
        actions={actions}
        folders={folders}
      />
    );
  })();

  return (
    <div className="space-y-5">
      <FilesToolbar
        basePath={basePath}
        filter={filter}
        query={query}
        onQueryChange={(next) => {
          setQuery(next);
          if (!next.trim()) {
            setPassageQuery("");
          }
        }}
        onQuerySubmit={projectId ? setPassageQuery : undefined}
        searchPlaceholder="Search files"
        types={types}
        type={activeType}
        onTypeChange={setType}
      />
      {projectId && passageQuery ? (
        <KnowledgePassages basePath={basePath} projectId={projectId} query={passageQuery} />
      ) : projectId && query.trim() ? (
        <Button
          variant="link"
          size="sm"
          icon={<TextSearch size={15} />}
          onClick={() => setPassageQuery(query.trim())}
        >
          Look inside files for “{query.trim()}”
        </Button>
      ) : null}
      {content}
    </div>
  );
}
