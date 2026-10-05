import { Button } from "@ngriffin_uk/polychat-component-ui";
import { NativeRecordForm } from "@ngriffin_uk/polychat-component-ui/records";
import {
  findProjectFlowNode,
  type ProjectFlowWait,
  type ProjectTask,
  type ResolveProjectFlowWaitInput,
} from "@ngriffin_uk/polychat-schemas";

export function TaskFlowReview({
  task,
  wait,
  canRespond,
  isBusy,
  errorMessage,
  onRespond,
}: {
  task: ProjectTask;
  wait: ProjectFlowWait | null;
  canRespond: boolean;
  isBusy: boolean;
  errorMessage?: string;
  onRespond: (wait: ProjectFlowWait, input: ResolveProjectFlowWaitInput) => Promise<boolean>;
}) {
  const node = wait ? findProjectFlowNode(task.flowSnapshot, wait.nodeId) : null;

  if (!wait || wait.kind !== "human" || node?.type !== "human_wait" || wait.status !== "pending") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{node.name}</h2>
      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{node.prompt}</p>
      {!canRespond ? (
        <p className="text-sm text-muted-foreground">Waiting for the assigned reviewer.</p>
      ) : node.fields.length ? (
        <NativeRecordForm
          key={`${wait.id}:${wait.revision}`}
          definition={{
            format: "records",
            columns: node.fields,
            visibility: "shared",
            editing: "shared",
          }}
          isSaving={isBusy}
          errorMessage={errorMessage}
          submitLabel="Accept and continue"
          cancelLabel="Reject"
          onSave={(values) =>
            onRespond(wait, { expectedRevision: wait.revision, resolution: "accepted", values })
          }
          onCancel={() => {
            void onRespond(wait, {
              expectedRevision: wait.revision,
              resolution: "rejected",
              values: {},
            });
          }}
        />
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              disabled={isBusy}
              onClick={() => {
                void onRespond(wait, {
                  expectedRevision: wait.revision,
                  resolution: "accepted",
                  values: {},
                });
              }}
            >
              Accept and continue
            </Button>
            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() => {
                void onRespond(wait, {
                  expectedRevision: wait.revision,
                  resolution: "rejected",
                  values: {},
                });
              }}
            >
              Reject
            </Button>
          </div>
          {errorMessage && (
            <p role="alert" className="text-sm text-failure">
              {errorMessage}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
