import { useRef, useState } from "react";

import { SITE_PROMPT_EXAMPLES } from "./site-examples.js";
import { SitePromptComposer } from "./SitePromptComposer.js";

export function SiteStarterPrompt({ onSubmit }: { onSubmit: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <SitePromptComposer
        size="hero"
        autoFocus
        placeholder="Describe a website, app or interface…"
        submitLabel="Build"
        isBusy={false}
        onSubmit={onSubmit}
        value={prompt}
        onValueChange={setPrompt}
        inputRef={inputRef}
        className="w-full max-w-2xl"
      />
      <div className="flex max-w-2xl flex-col items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">Start with an example</p>
        <ul className="flex flex-wrap justify-center gap-2">
          {SITE_PROMPT_EXAMPLES.map((example) => (
            <li key={example.title}>
              <button
                type="button"
                onClick={() => {
                  setPrompt(example.prompt);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
              >
                {example.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
