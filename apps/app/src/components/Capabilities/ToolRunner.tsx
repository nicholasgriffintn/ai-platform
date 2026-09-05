import { ToolForm } from "@ngriffin_uk/polychat-component-capabilities";
import { BackLink, Card, FormLoadingSkeleton } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import { ResponseRenderer } from "~/components/Apps/ResponseRenderer";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useExecuteRunnableTool, useRunnableTool } from "~/hooks/useRunnableTools";
import { isAuthenticationError } from "~/lib/errors";

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
    return <FormLoadingSkeleton />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to run this tool"
        message="Sign in to run tools and keep their results."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  if (error || !tool) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <Card className="p-8 text-center shadow-none">
          <h1 className="text-2xl font-bold text-foreground">Tool unavailable</h1>
          <p className="text-sm leading-6 text-muted-foreground">This tool no longer exists.</p>
          <BackLink href={backPath} label="Back to capabilities" />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14">
      <header className="mb-8">
        <BackLink href={backPath} label="Back to capabilities" />
      </header>
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
    </div>
  );
}
