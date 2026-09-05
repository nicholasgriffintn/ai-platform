import { Button, Card } from "@ngriffin_uk/polychat-component-ui";

export type PodcastProcessingAction = "transcribe" | "summarise" | "generate-image";

const ACTION_LABELS: Record<string, string> = {
  transcribe: "Transcribe podcast",
  summarise: "Create summary",
  "generate-image": "Generate cover image",
};

export interface PodcastNextActionCardProps {
  action: string | null;
  onRun: (action: string) => void;
  isRunning?: boolean;
}

export function PodcastNextActionCard({
  action,
  onRun,
  isRunning = false,
}: PodcastNextActionCardProps) {
  if (!action) {
    return null;
  }

  const label = ACTION_LABELS[action] ?? action;

  return (
    <Card className="flex-row items-center justify-between gap-4 p-4 shadow-none">
      <div>
        <p className="text-sm font-medium">Continue processing</p>
        <p className="text-sm text-muted-foreground">
          {label} to build the next part of this podcast.
        </p>
      </div>
      <Button variant="primary" isLoading={isRunning} onClick={() => onRun(action)}>
        {label}
      </Button>
    </Card>
  );
}
