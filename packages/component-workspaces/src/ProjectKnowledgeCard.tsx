import { Button, Card, Checkbox, FormDialog, TextLink } from "@ngriffin_uk/polychat-component-ui";
import { Brain, Database, ArrowRight } from "lucide-react";
import { useState } from "react";

export interface ProjectSourceSummary {
  id: string;
  title: string;
  kind: string;
}

export interface ProjectKnowledgeCardProps {
  canManage: boolean;
  /** Rendered without its own card chrome when the parent already provides one. */
  embedded?: boolean;
  memories: ProjectSourceSummary[];
  contextSources: ProjectSourceSummary[];
  /** Sources that may be pinned as persistent conversation context. */
  contextCandidates: ProjectSourceSummary[];
  sourcesHref: string;
  isSavingContext?: boolean;
  onSaveContext: (sourceIds: string[]) => Promise<void>;
}

export function ProjectKnowledgeCard({
  canManage,
  embedded = false,
  memories,
  contextSources,
  contextCandidates,
  sourcesHref,
  isSavingContext = false,
  onSaveContext,
}: ProjectKnowledgeCardProps) {
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);

  const openContext = () => {
    setSelectedContextIds(contextSources.map((source) => source.id));
    setIsContextOpen(true);
  };

  const content = (
    <>
      <section className={`space-y-3 p-5 ${embedded ? "border-t border-border" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-active-work/12 p-2 text-active-work">
              <Brain size={17} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Project memory</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Shared facts are recalled when relevant in project conversations.
              </p>
            </div>
          </div>
        </div>
        {memories.length ? (
          <ul className="space-y-1.5 pl-11 text-sm text-foreground">
            {memories.slice(0, 3).map((memory) => (
              <li key={memory.id} className="truncate">
                {memory.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pl-11 text-sm text-muted-foreground">No project memories yet.</p>
        )}
      </section>

      <section className="space-y-3 border-t border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-active-work/12 p-2 text-active-work">
              <Database size={17} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Conversation context</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Selected sources stay attached across project conversations.
              </p>
            </div>
          </div>
          {canManage ? (
            <Button variant="outline" size="sm" onClick={openContext}>
              Manage
            </Button>
          ) : null}
        </div>
        {contextSources.length ? (
          <ul className="space-y-1.5 pl-11 text-sm text-foreground">
            {contextSources.slice(0, 3).map((source) => (
              <li key={source.id} className="truncate">
                {source.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pl-11 text-sm text-muted-foreground">No persistent context selected.</p>
        )}
        <TextLink
          href={sourcesHref}
          size="xs"
          trailingIcon={<ArrowRight size={13} />}
          className="ml-11"
        >
          Browse project sources
        </TextLink>
      </section>
    </>
  );

  return (
    <>
      {embedded ? (
        content
      ) : (
        <Card className="gap-0 overflow-hidden py-0 shadow-none">{content}</Card>
      )}

      <FormDialog
        open={isContextOpen}
        onOpenChange={setIsContextOpen}
        title="Manage conversation context"
        description="Choose project sources to attach whenever a project conversation starts."
        submitText="Save context"
        isLoading={isSavingContext}
        onSubmit={async () => {
          await onSaveContext(selectedContextIds);
          setIsContextOpen(false);
        }}
      >
        {contextCandidates.length ? (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {contextCandidates.map((source) => (
              <label
                key={source.id}
                htmlFor={`context-source-${source.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <Checkbox
                  id={`context-source-${source.id}`}
                  checked={selectedContextIds.includes(source.id)}
                  onCheckedChange={(checked) =>
                    setSelectedContextIds((current) =>
                      checked === true
                        ? [...current, source.id]
                        : current.filter((id) => id !== source.id),
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{source.title}</span>
                  <span className="block text-xs capitalize text-muted-foreground">
                    {source.kind}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Upload a source in project chat before selecting persistent context.
          </p>
        )}
      </FormDialog>
    </>
  );
}
