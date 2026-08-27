import { Card, Link } from "@ngriffin_uk/polychat-component-ui";

export interface OutputSummary {
  id: string;
  title: string;
  capabilityId: string;
  createdAt: string;
  updatedAt?: string | null;
  href: string;
}

export interface OutputCardGridProps {
  outputs: OutputSummary[];
}

export function OutputCardGrid({ outputs }: OutputCardGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {outputs.map((item) => (
        <Link key={item.id} href={item.href} className="group no-underline hover:!no-underline">
          <Card className="h-full gap-3 p-5 shadow-none hover:border-zinc-400 dark:hover:border-zinc-600">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {item.capabilityId}
            </p>
            <h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
              {item.title}
            </h2>
            <p className="mt-auto pt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {new Date(item.updatedAt ?? item.createdAt).toLocaleString()}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
