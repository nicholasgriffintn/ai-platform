import { Card, CardContent } from "@ngriffin_uk/polychat-component-ui";

export interface TrainingSummaryCardProps {
  label: string;
  value: number;
}

export function TrainingSummaryCard({ label, value }: TrainingSummaryCardProps) {
  return (
    <Card className="py-4 shadow-none">
      <CardContent className="space-y-1">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
