import { Button, Card } from "@ngriffin_uk/polychat-component-ui";
import type {
  AuthoredSkillHistoryResponse,
  AuthoredSkillVersionedDocument,
} from "@ngriffin_uk/polychat-schemas";

interface SkillHistoryPanelProps {
  history: AuthoredSkillHistoryResponse;
  leftId?: string;
  rightId?: string;
  left?: AuthoredSkillVersionedDocument;
  right?: AuthoredSkillVersionedDocument;
  isRollingBack: boolean;
  onLeftChange: (revisionId: string) => void;
  onRightChange: (revisionId: string) => void;
  onRollback: (revisionId: string) => Promise<unknown>;
}

function RevisionSelect({
  label,
  value,
  history,
  onChange,
}: {
  label: string;
  value?: string;
  history: AuthoredSkillHistoryResponse;
  onChange: (revisionId: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <select
        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {history.revisions.map((revision) => (
          <option key={revision.id} value={revision.id}>
            Revision {revision.revision}
            {revision.id === history.state.stableRevisionId ? " (live)" : ""}
            {revision.id === history.state.draftRevisionId ? " (draft)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SkillHistoryPanel(props: SkillHistoryPanelProps) {
  return (
    <Card className="gap-4 p-6 shadow-none">
      <div>
        <h2 className="text-lg font-semibold">Compare revisions</h2>
        <p className="text-sm text-zinc-500">
          Inspect exact saved versions before promoting or rolling back.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <RevisionSelect
          label="Earlier version"
          value={props.leftId}
          history={props.history}
          onChange={props.onLeftChange}
        />
        <RevisionSelect
          label="Later version"
          value={props.rightId}
          history={props.history}
          onChange={props.onRightChange}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[props.left, props.right].map((document, index) => (
          <pre
            key={document?.revision.id ?? index}
            className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-xs dark:bg-zinc-900"
          >
            {document?.content ?? "Loading revision…"}
          </pre>
        ))}
      </div>
      {props.leftId && props.leftId !== props.history.state.draftRevisionId && (
        <Button
          variant="outline"
          className="self-start"
          isLoading={props.isRollingBack}
          onClick={() => void props.onRollback(props.leftId!)}
        >
          Restore earlier version as a new draft
        </Button>
      )}
    </Card>
  );
}
