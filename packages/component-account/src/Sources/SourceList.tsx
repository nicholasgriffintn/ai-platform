import {
  Button,
  Card,
  EmptyState,
  FormSelect,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import { getSourceMediaType } from "@ngriffin_uk/polychat-schemas";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import {
  Database,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Mic,
  Radio,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";

export interface SourceSummary {
  id: string;
  title: string;
  kind: string;
  status?: string;
  createdAt: string;
  updatedAt?: string | null;
  file?: { mimeType: string } | null;
  metadata?: Record<string, unknown>;
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
  itemHref?: (source: SourceSummary) => string;
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
  itemHref,
  onAddToCollection,
  onDelete,
}: SourceListProps) {
  if (errorMessage) {
    return <EmptyState title="Sources unavailable" message={errorMessage} />;
  }

  if (isLoading) {
    return <Card className="p-5 text-sm text-muted-foreground shadow-none">Loading sources…</Card>;
  }

  if (!sources?.length) {
    return (
      <EmptyState
        icon={<Database size={24} className="text-muted-foreground" />}
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
    <div className="-mx-6">
      {sources.map((source) => (
        <div
          key={source.id}
          className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-selection text-muted-foreground">
            {sourceIcon(source)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">
              {itemHref ? (
                <a href={itemHref(source)} className={textLinkClassName({})}>
                  {source.title}
                </a>
              ) : (
                source.title
              )}
            </h3>
            <p className="text-xs text-muted-foreground capitalize">
              {sourceLabel(source)} · {formatDate(source.updatedAt ?? source.createdAt)}
              {source.status === "processing" ? " · Processing" : null}
              {source.status === "failed" ? " · Failed" : null}
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
              value=""
              placeholder="Add to collection…"
              options={collections.map((collection) => ({
                value: collection.id,
                label: collection.title,
              }))}
              onValueChange={(collectionId) => onAddToCollection(collectionId, source.id)}
              className="max-w-40"
            />
          ) : null}
          {!(source.kind === "connector" && typeof source.metadata?.syncId === "string") ? (
            <Button
              variant="icon"
              size="icon"
              icon={<Trash2 size={15} />}
              aria-label={`Delete ${source.title}`}
              onClick={() => onDelete(source.id)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function sourceIcon(source: SourceSummary): ReactNode {
  const mediaType = getSourceMediaType(source.file?.mimeType);

  if (source.kind === "podcast") {
    return <Radio size={17} />;
  }

  if (mediaType === "image") {
    return <ImageIcon size={17} />;
  }

  if (mediaType === "video") {
    return <Film size={17} />;
  }

  if (mediaType === "audio") {
    return <Mic size={17} />;
  }

  return source.kind === "url" ? <Link2 size={17} /> : <FileText size={17} />;
}

function sourceLabel(source: SourceSummary): string {
  const mediaType = getSourceMediaType(source.file?.mimeType);

  return source.kind === "file" && mediaType ? mediaType : source.kind;
}
