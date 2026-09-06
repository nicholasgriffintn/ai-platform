import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { Database, Plus, Trash2 } from "lucide-react";

import { SettingsSection } from "../SettingsSection";

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
    isActive ? "bg-selection text-foreground" : "text-muted-foreground hover:text-foreground",
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
    <SettingsSection
      title="Collections"
      actions={
        <Button
          variant="icon"
          size="icon"
          icon={<Plus size={15} />}
          aria-label="Create collection"
          onClick={onCreateCollection}
        />
      }
      contentClassName="flex min-w-0 flex-col gap-1"
    >
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
        <div key={collection.id} className="group relative min-w-0">
          <button
            type="button"
            className={collectionButtonClass(
              selectedCollectionId === collection.id,
              "w-full min-w-0 pr-11",
            )}
            onClick={() => onSelectCollection(collection.id)}
          >
            <span className="block truncate">{collection.title}</span>
            <span className="text-muted-foreground block text-xs">
              {collection.sourceCount} {collection.sourceCount === 1 ? "source" : "sources"}
            </span>
          </button>
          <Button
            variant="icon"
            size="icon"
            icon={<Trash2 size={14} />}
            aria-label={`Delete ${collection.title}`}
            className="absolute top-1/2 right-1 -translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            onClick={() => onDeleteCollection(collection.id)}
          />
        </div>
      ))}
    </SettingsSection>
  );
}
