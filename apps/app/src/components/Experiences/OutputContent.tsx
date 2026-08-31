import { LeanProofResultView } from "@ngriffin_uk/polychat-component-experiences/development";
import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { leanProofResultSchema } from "@ngriffin_uk/polychat-schemas";

import { ResponseRenderer } from "~/components/Apps/ResponseRenderer";
import { useRunnableTool } from "~/hooks/useRunnableTools";

export function OutputContent({
  capabilityId,
  content,
  kind,
}: {
  capabilityId: string;
  content: Record<string, unknown>;
  kind: string;
}) {
  const { data: producingTool } = useRunnableTool(kind === "lean.proof" ? null : capabilityId);

  if (kind === "lean.proof") {
    const parsed = leanProofResultSchema.safeParse(content);

    return parsed.success ? (
      <LeanProofResultView result={parsed.data} />
    ) : (
      <EmptyState
        title="Proof result unavailable"
        message="This saved result does not match the current Lean proof format."
      />
    );
  }

  return <ResponseRenderer app={producingTool ?? undefined} result={content} />;
}
