import type { ChatRun } from "@ngriffin_uk/polychat-schemas";

import { getChatRunPresentation } from "~/lib/chat/run-presentation";

const toneClasses = {
  active: "border-active-work/45 bg-active-work/12 text-foreground",
  attention: "border-attention/45 bg-attention/12 text-foreground",
  danger: "border-failure/45 bg-failure/12 text-failure",
  neutral: "border-border bg-surface-elevated text-foreground",
  success: "border-success/45 bg-success/12 text-success",
} as const;

export function ChatRunStatusBanner({ run }: { run: ChatRun }) {
  const presentation = getChatRunPresentation(run);

  return (
    <output className="block w-full pb-2" aria-live="polite">
      <div className={`rounded-lg border px-3 py-2 text-sm ${toneClasses[presentation.tone]}`}>
        <span className="font-medium">{presentation.label}</span>
        <span className="ml-2 opacity-80">{presentation.detail}</span>
      </div>
    </output>
  );
}
