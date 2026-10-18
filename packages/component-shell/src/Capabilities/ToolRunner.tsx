import { ToolForm } from "@ngriffin_uk/polychat-component-capabilities";
import { BackLink, FormLoadingSkeleton } from "@ngriffin_uk/polychat-component-ui";
import {
  getErrorMessage,
  isAuthenticationError,
  isNotFoundError,
} from "@ngriffin_uk/polychat-library-client";
import { useExecuteRunnableTool, useRunnableTool } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { ResponseRenderer } from "../Content/ResponseRenderer.js";
import { PageShell } from "../Shell/PageShell.js";

interface ToolRunnerProps {
  backPath: string;
  projectId?: string;
  toolId: string;
}

export function ToolRunner({ backPath, projectId, toolId }: ToolRunnerProps) {
  const { data: tool, isLoading, error } = useRunnableTool(toolId);
  const executeTool = useExecuteRunnableTool();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  if (isLoading) {
    return (
      <PageShell.Content>
        <FormLoadingSkeleton />
      </PageShell.Content>
    );
  }

  if (isAuthenticationError(error)) {
    return (
      <PageShell.Content>
        <PageShell.Header title="Tool" />
        <SignInEmptyState
          title="Sign in to run this tool"
          message="Sign in to run tools and keep their results."
          className="min-h-[300px]"
        />
      </PageShell.Content>
    );
  }

  if (error || !tool) {
    const isMissing = isNotFoundError(error) || !tool;

    return (
      <PageShell.Content>
        <PageShell.Header title={isMissing ? "Tool unavailable" : "Could not load this tool"} />
        <BackLink href={backPath} label="Back to capabilities" />
        <p role="alert" className="text-sm leading-6 text-muted-foreground">
          {isMissing
            ? "This tool no longer exists."
            : getErrorMessage(error, "Try again in a moment.")}
        </p>
      </PageShell.Content>
    );
  }

  return (
    <PageShell.Content>
      <PageShell.Header title={tool.name} />
      <BackLink href={backPath} label="Back to capabilities" />
      {result ? (
        <ResponseRenderer app={tool} result={result} onReset={() => setResult(null)} />
      ) : (
        <ToolForm
          tool={tool}
          onSubmit={(formData) => executeTool.mutateAsync({ id: toolId, formData, projectId })}
          onComplete={setResult}
          isSubmitting={executeTool.isPending}
        />
      )}
    </PageShell.Content>
  );
}
