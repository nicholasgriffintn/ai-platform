import type { ChatRun } from "@ngriffin_uk/polychat-schemas";

import { getChatRunPresentation } from "~/lib/chat/run-presentation";

const toneClasses = {
  active:
    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
  attention:
    "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  danger:
    "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  neutral:
    "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
} as const;

export function ChatRunStatusBanner({ run }: { run: ChatRun }) {
  const presentation = getChatRunPresentation(run);

  return (
    <output className="mx-auto block w-full max-w-4xl px-4 pb-2" aria-live="polite">
      <div className={`rounded-lg border px-3 py-2 text-sm ${toneClasses[presentation.tone]}`}>
        <span className="font-medium">{presentation.label}</span>
        <span className="ml-2 opacity-80">{presentation.detail}</span>
      </div>
    </output>
  );
}
