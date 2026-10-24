import { ListItem } from "@ngriffin_uk/polychat-component-ui";
import { useSources } from "@ngriffin_uk/polychat-library-react";
import { FileText } from "lucide-react";

export interface LinkedFileSource {
  id: string;
  name: string | null;
}

export function FileSourcesList({
  sources,
  projectId,
  onOpen,
}: {
  sources: readonly LinkedFileSource[];
  projectId?: string;
  onOpen: (sourceId: string) => void;
}) {
  const { data: available = [], isLoading } = useSources(projectId ? { projectId } : {});
  const availableById = new Map(available.map((source) => [source.id, source]));

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">This file was not made from any sources.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {sources.map((source) => {
        const match = availableById.get(source.id);
        const title = match?.title ?? source.name ?? "Unavailable source";

        return (
          <ListItem
            key={source.id}
            data-id={source.id}
            icon={<FileText size={14} aria-hidden="true" />}
            label={title}
            sublabel={match ? undefined : isLoading ? "Checking…" : "No longer available"}
            onClick={match ? () => onOpen(source.id) : undefined}
          />
        );
      })}
    </ul>
  );
}
