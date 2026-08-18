import { Button, Card, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { Send } from "lucide-react";
import { useState } from "react";

export interface ProjectConversationStarterProps {
  /** Receives the trimmed prompt; the host decides where the conversation opens. */
  onStart: (prompt: string) => void;
}

export function ProjectConversationStarter({ onStart }: ProjectConversationStarterProps) {
  const [input, setInput] = useState("");

  const startConversation = () => {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      return;
    }

    onStart(trimmedInput);
  };

  return (
    <Card className="gap-3 border-zinc-300 p-3 shadow-none dark:border-zinc-700">
      <Textarea
        aria-label="Start a project conversation"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            startConversation();
          }
        }}
        placeholder="What would you like to work on?"
        className="min-h-28 resize-none border-0 bg-transparent px-2 py-2 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          Uses this project&apos;s instructions, memory, context, and capabilities.
        </p>
        <Button
          variant="primary"
          icon={<Send size={16} />}
          disabled={!input.trim()}
          onClick={startConversation}
        >
          Start conversation
        </Button>
      </div>
    </Card>
  );
}
