import { Card, CardContent } from "@ngriffin_uk/polychat-component-ui";

export interface TrainingSummaryCardProps {
  label: string;
  value: number;
}

export function TrainingSummaryCard({ label, value }: TrainingSummaryCardProps) {
  return (
    <Card className="shadow-none py-4">
      <CardContent className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </div>
        <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
      </CardContent>
    </Card>
  );
}
