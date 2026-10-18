import { Button, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { useTeammateContextMemory } from "@ngriffin_uk/polychat-library-react";
import {
  getErrorMessage,
  type MarkdownBlock,
  removeMarkdownBlock,
  splitMarkdownBlocks,
} from "@ngriffin_uk/polychat-utility-core";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TeammateMemoryPanel } from "../Teammates/TeammateMemoryPanel.js";

export function PolyMemoryView({ contextId }: { contextId: string }) {
  const memory = useTeammateContextMemory(contextId);
  const [isEditing, setIsEditing] = useState(false);
  const [forgetting, setForgetting] = useState<number | null>(null);

  if (isEditing) {
    return (
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
          Back to the list
        </Button>
        <TeammateMemoryPanel contextId={contextId} />
      </div>
    );
  }

  if (memory.isLoading || !memory.data) {
    return memory.error ? (
      <div className="p-6">
        <EmptyState
          title="Poly's notes are out of reach"
          message={getErrorMessage(memory.error, "Try again in a moment.")}
        />
      </div>
    ) : (
      <output className="flex flex-1 items-center justify-center">
        <Loader2 size={20} aria-hidden="true" className="animate-spin text-muted-foreground" />
        <span className="sr-only">Opening what Poly knows</span>
      </output>
    );
  }

  const document = memory.data;
  const blocks = splitMarkdownBlocks(document.content);

  const forget = async (block: MarkdownBlock) => {
    setForgetting(block.start);

    try {
      await memory.update.mutateAsync({
        content: removeMarkdownBlock(document.content, block),
        expectedRevision: document.revision,
      });
      toast.success("Forgotten");
    } catch (error) {
      toast.error(getErrorMessage(error, "Poly could not forget that"));
    } finally {
      setForgetting(null);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          What Poly keeps between conversations. Forget anything that is wrong or none of its
          business.
        </p>
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          Edit all
        </Button>
      </div>
      {blocks.length === 0 ? (
        <EmptyState
          title="Nothing kept yet"
          message="Tell Poly something worth remembering and it will appear here."
        />
      ) : (
        <ul className="space-y-1">
          {blocks.map((block) =>
            block.kind === "heading" ? (
              <li key={block.start} className="polychat-eyebrow pt-3 first:pt-0">
                {block.text}
              </li>
            ) : (
              <li
                key={block.start}
                className="group flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                <span className="min-w-0 flex-1 text-sm text-foreground">{block.text}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 opacity-70 group-hover:opacity-100"
                  isLoading={forgetting === block.start}
                  disabled={forgetting !== null}
                  aria-label={`Forget: ${block.text}`}
                  onClick={() => void forget(block)}
                >
                  Forget
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
