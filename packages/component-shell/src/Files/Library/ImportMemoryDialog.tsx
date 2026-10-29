import { Button, FormDialog, FormTextarea } from "@ngriffin_uk/polychat-component-ui";
import { readAssistantExport } from "@ngriffin_uk/polychat-library-chat/assistant-exports";
import { useImportMemory } from "@ngriffin_uk/polychat-library-react";
import {
  MEMORY_IMPORT_SOURCE_LABELS,
  type CreateMemoryImportInput,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useCopyToClipboard } from "@ngriffin_uk/polychat-utility-react";
import { Upload } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

const SUMMARY_PROMPT =
  "Write down everything you know about me from our conversations and your memory: who I am, my work, the people in my life, my preferences, goals, ongoing projects and how I like to be helped. Use plain statements, one per line, with dates where you know them. Leave out anything you are unsure of.";

function describeExport(input: CreateMemoryImportInput): string {
  if (input.kind === "summary") {
    return "";
  }

  const messages = input.conversations.reduce(
    (total, conversation) => total + conversation.messages.length,
    0,
  );

  return `${MEMORY_IMPORT_SOURCE_LABELS[input.source]}: ${input.conversations.length} conversations, ${messages} of your messages.`;
}

export function ImportMemoryDialog({ onClose }: { onClose: () => void }) {
  const fileInputId = useId();
  const importMemory = useImportMemory();
  const { copied, copy } = useCopyToClipboard();
  const [exported, setExported] = useState<CreateMemoryImportInput | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [summary, setSummary] = useState("");
  const input: CreateMemoryImportInput | null =
    exported ?? (summary.trim() ? { kind: "summary", text: summary.trim() } : null);

  const chooseFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setIsReading(true);

    try {
      const parsed = await readAssistantExport(files);

      setExported(parsed);

      if (!parsed) {
        toast.error("That doesn't look like a ChatGPT or Claude export.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not read those files"));
    } finally {
      setIsReading(false);
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Bring memory over"
      description="Polychat reads what you wrote elsewhere and keeps what will still matter, each with the words it came from. Nothing else from the export is kept."
      submitText="Start reading"
      isLoading={importMemory.isPending || isReading}
      submitDisabled={!input}
      onSubmit={async () => {
        if (!input) {
          return;
        }

        try {
          const started = await importMemory.mutateAsync(input);

          toast.success(
            `Reading ${started.messages} passages in the background. Memories turn up here as they're filed.`,
          );
          onClose();
        } catch (error) {
          toast.error(getErrorMessage(error, "Could not start the import"));
          throw error;
        }
      }}
    >
      <div className="space-y-2">
        <p className="text-sm text-foreground">From a ChatGPT or Claude export</p>
        <label
          htmlFor={fileInputId}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50"
        >
          <Upload size={16} aria-hidden="true" />
          {isReading
            ? "Reading the export…"
            : "Choose the export's .zip files or conversations.json"}
        </label>
        <input
          id={fileInputId}
          type="file"
          multiple
          accept=".zip,.json,application/zip,application/json"
          className="sr-only"
          onChange={(event) => {
            void chooseFiles(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
        />
        {exported ? (
          <p className="text-xs text-muted-foreground">{describeExport(exported)}</p>
        ) : null}
      </div>
      {exported ? null : (
        <div className="space-y-2">
          <FormTextarea
            label="Or paste what another assistant knows about you"
            description="Works with Gemini, Meta AI or anything else that remembers you. Ask it with the prompt below, then paste its answer."
            value={summary}
            rows={5}
            onChange={(event) => setSummary(event.target.value)}
          />
          <Button type="button" variant="link" size="sm" onClick={() => copy(SUMMARY_PROMPT)}>
            {copied ? "Prompt copied" : "Copy the prompt"}
          </Button>
        </div>
      )}
    </FormDialog>
  );
}
