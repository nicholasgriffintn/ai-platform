import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { BackLink } from "~/components/BackLink";
import { PageHeader } from "~/components/PageHeader";
import { PageShell } from "~/components/PageShell";
import { PageTitle } from "~/components/PageTitle";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { Button, Input, Label, FormSelect as Select } from "~/components/ui";
import { useCheckProcessingStatus, useCreateVideoNote } from "~/hooks/useVideoNotes";

export function meta() {
  return [
    { title: "New Video Note - Polychat" },
    { name: "description", content: "Create a note from a video URL." },
  ];
}

export default function NewVideoNotePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [timestamps, setTimestamps] = useState(false);
  const [provider, setProvider] = useState<"workers" | "mistral" | "">("");
  const [generateSummary, setGenerateSummary] = useState(true);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const createMutation = useCreateVideoNote();
  const { data: statusData } = useCheckProcessingStatus(createdId || undefined);

  useEffect(() => {
    if (statusData?.status === "complete" && createdId) {
      navigate(`/apps/video-notes/${createdId}`, { replace: true });
    }
  }, [statusData?.status, createdId, navigate]);

  const handleSubmit = useCallback(async () => {
    if (!url) return;
    const result = await createMutation.mutateAsync({
      url,
      timestamps,
      provider: provider || undefined,
      generateSummary,
    });
    setCreatedId(result.noteId);
  }, [createMutation, url, timestamps, provider, generateSummary]);

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="max-w-2xl mx-auto"
      headerContent={
        <PageHeader>
          <BackLink to="/apps/video-notes" label="Back to Video Notes" />
          <PageTitle title="Create Video Note" />
        </PageHeader>
      }
      isBeta={true}
    >
      <div className="space-y-6">
        <div>
          <Label htmlFor="url">Video URL</Label>
          <Input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="provider">Transcription Provider</Label>
            <Select
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)
              options={[
                { label: "Default (Workers)", value: "" },
                { label: "Workers", value: "workers" },
                { label: "Mistral", value: "mistral" },
              ]}
            />
          </div>
          <div className="flex items-end gap-2">
            <input
              id="timestamps"
              type="checkbox"
              className="h-4 w-4"
              checked={timestamps}
              onChange={(e) => setTimestamps(e.target.checked)}
            />
            <Label htmlFor="timestamps">Include timestamps</Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="generateSummary"
            type="checkbox"
            className="h-4 w-4"
            checked={generateSummary}
            onChange={(e) => setGenerateSummary(e.target.checked)}
          />
          <Label htmlFor="generateSummary">Generate AI summary</Label>
        </div>
        <div className="flex gap-3">
          <Button
            variant="primary"
            disabled={!url || createMutation.isPending}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? "Processing..." : "Create"}
          </Button>
        </div>
        {createdId ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Status: {statusData?.status || "processing"}
          </div>
        ) : null}
        {createMutation.error ? (
          <div className="text-sm text-red-600">
            {createMutation.error.message}
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}