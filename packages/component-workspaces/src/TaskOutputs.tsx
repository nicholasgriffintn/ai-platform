import { Link } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectTaskStageOutput } from "@ngriffin_uk/polychat-schemas";
import { humaniseIdentifier } from "@ngriffin_uk/polychat-utility-core";
import { FileText } from "lucide-react";

import { TaskSection } from "./TaskWorkSections";

export function TaskOutputs({
  outputs,
  outputHref,
}: {
  outputs: readonly ProjectTaskStageOutput[];
  outputHref: (outputId: string) => string;
}) {
  if (outputs.length === 0) {
    return null;
  }

  return (
    <TaskSection title="Files" meta={`${outputs.length} made by this task`}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {outputs.map((output) => (
          <li key={output.id}>
            <Link
              href={outputHref(output.id)}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm no-underline hover:border-border-strong hover:!no-underline"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-active-work/12 text-active-work">
                <FileText size={15} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{output.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {humaniseIdentifier(output.kind)}
                  {output.status === "pending" ? " · being written" : ""}
                  {output.status === "failed" ? " · failed" : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </TaskSection>
  );
}
