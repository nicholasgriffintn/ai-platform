import { getResponsePresentation } from "@ngriffin_uk/polychat-library-react";
import type { PlatformResponse } from "@ngriffin_uk/polychat-schemas";

import { runChargeNote } from "../ContextRail/labels.js";

const toneClasses = {
  active: "border-active-work/45 bg-active-work/12 text-foreground",
  attention: "border-attention/45 bg-attention/12 text-foreground",
  danger: "border-failure/45 bg-failure/12 text-failure",
  neutral: "border-border bg-surface-elevated text-foreground",
  success: "border-success/45 bg-success/12 text-success",
} as const;

export function ChatRunStatusBanner({ response }: { response: PlatformResponse }) {
  const presentation = getResponsePresentation(response);
  const chargeNote = response.usage ? runChargeNote(response.usage) : null;

  return (
    <output className="block w-full pb-2" aria-live="polite">
      <div
        className={`rounded-lg border px-3 py-2 text-sm ${toneClasses[presentation.tone]} ${
          presentation.tone === "danger" ? "polychat-motion-ruffle" : ""
        }`}
      >
        <span className="font-medium">{presentation.label}</span>
        <span className="ml-2 break-words whitespace-normal opacity-80">{presentation.detail}</span>
        {chargeNote ? <span className="ml-2 opacity-80">{chargeNote}</span> : null}
      </div>
    </output>
  );
}
