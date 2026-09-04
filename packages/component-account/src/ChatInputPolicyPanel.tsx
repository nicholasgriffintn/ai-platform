import { Button, Card, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  chatInputPolicySchema,
  type ChatInputPolicy,
  type ChatInputPolicyState,
  type ChatInputPolicyPreview,
} from "@ngriffin_uk/polychat-schemas";
import { useId, useState } from "react";

export interface ChatInputPolicyPanelProps {
  state: ChatInputPolicyState;
  canManage: boolean;
  isSaving: boolean;
  isPreviewing: boolean;
  errorMessage?: string;
  preview?: ChatInputPolicyPreview;
  onReload: () => void;
  onSave: (policy: ChatInputPolicy) => void;
  onPreview: (policy: ChatInputPolicy, content: string) => void;
}

export function ChatInputPolicyPanel({
  state,
  canManage,
  isSaving,
  isPreviewing,
  errorMessage,
  preview,
  onReload,
  onSave,
  onPreview,
}: ChatInputPolicyPanelProps) {
  const [draft, setDraft] = useState(state.policy);
  const [sample, setSample] = useState('{\n  "status": "ok",\n  "items": [1, 2, 3]\n}');
  const sampleId = useId();

  return (
    <Card className="m-4 space-y-4 p-5 shadow-none">
      <div>
        <h2 className="text-sm font-semibold">Tool output rewriting</h2>
        <p className="text-xs leading-5 text-zinc-500">
          Compact JSON tool results by default before sending them to the model. Keep the original
          history and all JSON values. Ordinary text, malformed JSON, and structured or signed parts
          stay unchanged.
        </p>
      </div>
      <FormSelect
        label="Rewrite policy"
        value={draft.toolOutputRewriting}
        disabled={!canManage || isSaving}
        options={[
          { value: "off", label: "Off" },
          { value: "compact_json", label: "Compact JSON whitespace" },
        ]}
        onChange={(event) =>
          setDraft(chatInputPolicySchema.parse({ toolOutputRewriting: event.target.value }))
        }
      />
      {canManage && (
        <div className="flex gap-2">
          <Button
            disabled={isSaving || draft.toolOutputRewriting === state.policy.toolOutputRewriting}
            isLoading={isSaving}
            onClick={() => onSave(draft)}
          >
            Save policy
          </Button>
          <Button variant="secondary" disabled={isSaving} onClick={() => setDraft(state.policy)}>
            Discard changes
          </Button>
        </div>
      )}
      {errorMessage && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage}{" "}
          <button type="button" className="underline" onClick={onReload}>
            Reload policy
          </button>
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Preview without saving</summary>
        <label className="mt-3 block text-xs" htmlFor={sampleId}>
          Example tool result
        </label>
        <textarea
          id={sampleId}
          className="my-2 w-full rounded border border-zinc-300 bg-transparent p-2 font-mono text-xs dark:border-zinc-700"
          rows={5}
          maxLength={1000000}
          value={sample}
          onChange={(event) => setSample(event.target.value)}
        />
        <Button
          variant="secondary"
          isLoading={isPreviewing}
          onClick={() => onPreview(draft, sample)}
        >
          Preview rewrite
        </Button>
        {preview && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-zinc-500">
              {preview.originalCharacters} → {preview.rewrittenCharacters} characters. Estimated
              saving: {preview.estimatedTokensSaved} tokens. Preview reflects the last submitted
              example.
            </p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              {preview.content}
            </pre>
          </div>
        )}
      </details>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Revision history ({state.revision})
        </summary>
        <p className="my-2 text-xs text-zinc-500">
          Keep the last 20 revisions. Restoring creates a new revision when you save.
        </p>
        <ul className="space-y-2">
          {[...state.history].reverse().map((entry) => (
            <li key={entry.revision} className="flex items-center justify-between gap-2 text-xs">
              <span>
                Revision {entry.revision} ·{" "}
                {entry.policy.toolOutputRewriting === "off" ? "Off" : "Compact JSON"} ·{" "}
                {entry.changedAt}
              </span>
              {canManage && entry.revision !== state.revision && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isSaving}
                  onClick={() => setDraft(entry.policy)}
                >
                  Restore revision {entry.revision}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
