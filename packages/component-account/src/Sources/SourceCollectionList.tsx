import { Button, Card, cn } from "@ngriffin_uk/polychat-component-ui";
import { Database, Plus, Trash2 } from "lucide-react";

export interface SourceCollection {
  id: string;
  title: string;
  sourceCount: number;
}

export interface SourceCollectionListProps {
  collections?: SourceCollection[];
  selectedCollectionId: string | null;
  onSelectCollection: (collectionId: string | null) => void;
  onCreateCollection: () => void;
  onDeleteCollection: (collectionId: string) => void;
}

function collectionButtonClass(isActive: boolean, extra = "") {
  return cn(
    "rounded-lg p-2 text-left text-sm transition-colors",
    isActive
      ? "bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
      : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-900",
    extra,
  );
}

export function SourceCollectionList({
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onDeleteCollection,
}: SourceCollectionListProps) {
  return (
    <Card className="gap-2 p-3 shadow-none">
      <div className="flex items-center justify-between px-2 pb-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Collections</h2>
        <Button
          variant="icon"
          size="icon"
          icon={<Plus size={15} />}
          aria-label="Create collection"
          onClick={onCreateCollection}
        />
      </div>
      <button
        type="button"
        className={collectionButtonClass(
          selectedCollectionId === null,
          "flex w-full items-center gap-2",
        )}
        onClick={() => onSelectCollection(null)}
      >
        <Database size={16} />
        <span className="min-w-0 flex-1 truncate">All sources</span>
      </button>
      {collections?.map((collection) => (
        <div key={collection.id} className="group flex items-center gap-1">
          <button
            type="button"
            className={collectionButtonClass(
              selectedCollectionId === collection.id,
              "min-w-0 flex-1",
            )}
            onClick={() => onSelectCollection(collection.id)}
          >
            <span className="block truncate">{collection.title}</span>
            <span className="block text-xs text-zinc-500">
              {collection.sourceCount} {collection.sourceCount === 1 ? "source" : "sources"}
            </span>
          </button>
          <Button
            variant="icon"
            size="icon"
            icon={<Trash2 size={14} />}
            aria-label={`Delete ${collection.title}`}
            className="shrink-0 md:opacity-0 md:group-hover:opacity-100"
            onClick={() => onDeleteCollection(collection.id)}
          />
        </div>
      ))}
    </Card>
  );
}
