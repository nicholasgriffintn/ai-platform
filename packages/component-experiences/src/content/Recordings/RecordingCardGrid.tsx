import { ButtonLink, Card, Link } from "@ngriffin_uk/polychat-component-ui";
import { Plus } from "lucide-react";

export interface RecordingSummary {
  id: string;
  title: string;
  status?: string;
  createdAt: string;
  imageUrl?: string | null;
  href: string;
}

export interface RecordingCardGridProps {
  recordings: RecordingSummary[];
  newRecordingHref: string;
}

export function RecordingCardGrid({ recordings, newRecordingHref }: RecordingCardGridProps) {
  return (
    <div>
      <div className="mb-5 flex justify-end">
        <ButtonLink variant="primary" icon={<Plus size={16} />} href={newRecordingHref}>
          New recording
        </ButtonLink>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recordings.map((item) => (
          <Link key={item.id} href={item.href} className="group no-underline hover:!no-underline">
            <Card className="h-full gap-3 p-5 shadow-none hover:border-border-strong">
              <div className="aspect-video overflow-hidden rounded-lg bg-selection">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <h2 className="font-semibold text-foreground group-hover:underline">{item.title}</h2>
              <p className="text-xs text-muted-foreground capitalize">
                {item.status} · {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
