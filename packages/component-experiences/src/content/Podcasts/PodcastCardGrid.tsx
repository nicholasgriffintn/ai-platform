import { ButtonLink, Card, Link } from "@ngriffin_uk/polychat-component-ui";
import { Plus } from "lucide-react";

export interface PodcastSummary {
  id: string;
  title: string;
  status?: string;
  createdAt: string;
  imageUrl?: string | null;
  href: string;
}

export interface PodcastCardGridProps {
  podcasts: PodcastSummary[];
  newPodcastHref: string;
}

export function PodcastCardGrid({ podcasts, newPodcastHref }: PodcastCardGridProps) {
  return (
    <div>
      <div className="mb-5 flex justify-end">
        <ButtonLink variant="primary" icon={<Plus size={16} />} href={newPodcastHref}>
          New podcast
        </ButtonLink>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {podcasts.map((item) => (
          <Link key={item.id} href={item.href} className="group no-underline hover:!no-underline">
            <Card className="h-full gap-3 p-5 shadow-none hover:border-zinc-400 dark:hover:border-zinc-600">
              <div className="aspect-video overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
                {item.title}
              </h2>
              <p className="text-xs capitalize text-zinc-500">
                {item.status} · {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
