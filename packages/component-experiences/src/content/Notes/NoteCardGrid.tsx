import { Button, Card, EmptyState, Link, SearchInput } from "@ngriffin_uk/polychat-component-ui";
import { Plus } from "lucide-react";

export interface NoteSummary {
  id: string;
  title?: string | null;
  content?: string | null;
  updatedAt: string;
  href: string;
}

export interface NoteCardGridProps {
  notes: NoteSummary[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  newNoteHref: string;
}

export function NoteCardGrid({
  notes,
  searchQuery,
  onSearchQueryChange,
  newNoteHref,
}: NoteCardGridProps) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={searchQuery}
          onChange={onSearchQueryChange}
          placeholder="Search notes..."
          className="max-w-md"
        />
        <Link href={newNoteHref}>
          <Button variant="primary" icon={<Plus size={16} />}>
            New note
          </Button>
        </Link>
      </div>
      {notes.length === 0 ? (
        <EmptyState
          title="No notes found"
          message={`No notes matching "${searchQuery}"`}
          action={
            <Button variant="secondary" onClick={() => onSearchQueryChange("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {notes.map((item) => (
            <Link key={item.id} href={item.href} className="group no-underline hover:!no-underline">
              <Card className="h-full gap-2 p-5 shadow-none hover:border-zinc-400 dark:hover:border-zinc-600">
                <h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
                  {item.title || "Untitled note"}
                </h2>
                <p className="line-clamp-3 text-sm leading-6 text-zinc-500">
                  {item.content || "Empty note"}
                </p>
                <p className="mt-auto pt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Updated {new Date(item.updatedAt).toLocaleDateString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
