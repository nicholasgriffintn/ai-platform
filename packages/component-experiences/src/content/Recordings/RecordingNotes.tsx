import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { RecordingActionItem } from "@ngriffin_uk/polychat-schemas";
import { Check, ListPlus } from "lucide-react";

export interface RecordingNotesProps {
  decisions?: string[];
  actionItems?: RecordingActionItem[];
  onAddActionItem?: (item: RecordingActionItem, index: number) => void;
  addedActionItems?: ReadonlySet<number>;
  addingActionItem?: number | null;
}

const NO_DECISIONS: string[] = [];
const NO_ACTION_ITEMS: RecordingActionItem[] = [];

function actionItemDetail(item: RecordingActionItem): string {
  return [item.owner, item.due && `due ${item.due}`].filter(Boolean).join(" · ");
}

export function RecordingNotes({
  decisions = NO_DECISIONS,
  actionItems = NO_ACTION_ITEMS,
  onAddActionItem,
  addedActionItems,
  addingActionItem = null,
}: RecordingNotesProps) {
  if (decisions.length === 0 && actionItems.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-6 pt-6 pb-2">
      {decisions.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">Decisions</h2>
          <ul className="list-disc space-y-1 pl-5 text-foreground">
            {decisions.map((decision) => (
              <li key={decision}>{decision}</li>
            ))}
          </ul>
        </section>
      )}

      {actionItems.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-foreground">Action items</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {actionItems.map((item, index) => {
              const detail = actionItemDetail(item);
              const added = addedActionItems?.has(index) ?? false;

              return (
                <li
                  key={`${item.task}-${item.owner ?? ""}-${item.due ?? ""}`}
                  className="flex items-start gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{item.task}</p>
                    {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
                  </div>
                  {onAddActionItem && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={added ? <Check size={16} /> : <ListPlus size={16} />}
                      disabled={added || addingActionItem !== null}
                      isLoading={addingActionItem === index}
                      onClick={() => onAddActionItem(item, index)}
                    >
                      {added ? "Added" : "Add to tasks"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
