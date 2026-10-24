import { MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import type { ReactNode } from "react";

export function MarkdownStage({ markdown, header }: { markdown: string; header?: ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      {header}
      <div className="prose max-w-none text-foreground dark:prose-invert">
        <MemoizedMarkdown>{markdown}</MemoizedMarkdown>
      </div>
    </article>
  );
}
