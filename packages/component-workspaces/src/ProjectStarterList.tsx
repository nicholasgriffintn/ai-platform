import { Button, Card, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { Hammer, Play } from "lucide-react";

export interface ProjectStarterCard {
  slug: string;
  name: string;
  description: string;
  when: string;
  teammates: Array<{ roleSlug: string; name: string; title: string }>;
}

export interface ProjectStarterListProps {
  starters: ProjectStarterCard[];
  isLoading: boolean;
  errorMessage?: string;
  startingSlug?: string | null;
  onStart: (starterSlug: string) => void;
}

export function ProjectStarterList({
  starters,
  isLoading,
  errorMessage,
  startingSlug,
  onStart,
}: ProjectStarterListProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Hammer size={18} className="text-muted-foreground" /> Starters
        </h2>
        <p className="text-sm text-muted-foreground">
          Projects that arrive with their teammates already hired.
        </p>
      </div>
      {errorMessage ? (
        <EmptyState title="Starters unavailable" message={errorMessage} />
      ) : isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground shadow-none">Loading starters…</Card>
      ) : starters.length === 0 ? (
        <EmptyState
          title="No starters"
          message="Starters ship with the product and will appear here."
          className="min-h-[180px]"
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          {starters.map((starter) => (
            <div
              key={starter.slug}
              className="flex items-start gap-3 border-b border-border px-5 py-4 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium">{starter.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{starter.when}</p>
                {starter.teammates.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Hires {starter.teammates.map((teammate) => teammate.name).join(", ")}
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="outline"
                icon={<Play size={14} />}
                aria-label={`Start ${starter.name}`}
                isLoading={startingSlug === starter.slug}
                onClick={() => onStart(starter.slug)}
              >
                Start
              </Button>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
