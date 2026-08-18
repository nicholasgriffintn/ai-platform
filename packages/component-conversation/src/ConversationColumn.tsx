import type { ReactNode } from "react";

export interface ConversationColumnProps {
  children: ReactNode;
}

export function ConversationMessageColumn({ children }: ConversationColumnProps) {
  return (
    <div className="min-h-0 flex-1 px-4">
      <div className="mx-auto w-full max-w-3xl h-full flex flex-col gap-8">{children}</div>
    </div>
  );
}

export function ConversationComposerDock({ children }: ConversationColumnProps) {
  return (
    <div className="relative z-10 shrink-0 px-4 pt-2">
      <div className="max-w-3xl mx-auto">{children}</div>
    </div>
  );
}
