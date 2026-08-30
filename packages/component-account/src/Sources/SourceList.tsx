import {
  Button,
  Card,
  EmptyState,
  FormSelect,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { Database, FileText, Link2, Trash2 } from "lucide-react";

export interface SourceSummary {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
  updatedAt?: string | null;
  file?: unknown;
}

export interface SourceCollectionSummary {
  id: string;
  title: string;
}

export interface SourceListProps {
  sources?: SourceSummary[];
  collections?: SourceCollectionSummary[];
  isLoading?: boolean;
  errorMessage?: string;
  isCollectionView?: boolean;
  fileHref?: (source: SourceSummary) => string;
  onAddToCollection?: (collectionId: string, sourceId: string) => void;
  onDelete: (sourceId: string) => void;
}

export function SourceList({
  sources,
  collections,
  isLoading = false,
  errorMessage,
  isCollectionView = false,
  fileHref,
  onAddToCollection,
  onDelete,
}: SourceListProps) {
  if (errorMessage) {
    return <EmptyState title="Sources unavailable" message={errorMessage} />;
  }

  if (isLoading) {
    return <Card className="p-6 text-sm text-zinc-500 shadow-none">Loading sources…</Card>;
  }

  if (!sources?.length) {
    return (
      <EmptyState
        icon={<Database size={24} className="text-zinc-400" />}
        title="No sources"
        message={
          isCollectionView
            ? "Add a source to this collection from the source list."
            : "Add a source to make it available to Polychat."
        }
        className="min-h-[220px]"
      />
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      {sources.map((source) => (
        <div
          key={source.id}
          className="flex items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
            {source.kind === "url" ? <Link2 size={17} /> : <FileText size={17} />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{source.title}</h3>
            <p className="text-xs capitalize text-zinc-500">
              {source.kind} · {formatDate(source.updatedAt ?? source.createdAt)}
            </p>
          </div>
          {source.file && fileHref ? (
            <a href={fileHref(source)} className={textLinkClassName({ className: "shrink-0" })}>
              Open file
            </a>
          ) : null}
          {onAddToCollection && collections?.length ? (
            <FormSelect
              aria-label={`Add ${source.title} to a collection`}
              fullWidth={false}
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) {
                  return;
                }

                onAddToCollection(event.target.value, source.id);
                event.target.value = "";
              }}
              className="max-w-40"
            >
              <option value="">Add to collection…</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </FormSelect>
          ) : null}
          <Button
            variant="icon"
            size="icon"
            icon={<Trash2 size={15} />}
            aria-label={`Delete ${source.title}`}
            onClick={() => onDelete(source.id)}
          />
        </div>
      ))}
    </Card>
  );
}
