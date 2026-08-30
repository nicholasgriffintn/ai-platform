import { Badge, ButtonLink, Card, Link } from "@ngriffin_uk/polychat-component-ui";
import { Music4, Plus } from "lucide-react";

export interface StrudelPatternSummary {
  id: string;
  name: string;
  description?: string | null;
  code: string;
  tags?: string[];
  updatedAt: string;
  href: string;
}

export interface StrudelPatternGridProps {
  patterns: StrudelPatternSummary[];
  newPatternHref: string;
}

export function StrudelPatternGrid({ patterns, newPatternHref }: StrudelPatternGridProps) {
  return (
    <div>
      <div className="mb-5 flex justify-end">
        <ButtonLink variant="primary" icon={<Plus size={16} />} href={newPatternHref}>
          New pattern
        </ButtonLink>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {patterns.map((pattern) => (
          <Link
            key={pattern.id}
            href={pattern.href}
            className="group no-underline hover:!no-underline"
          >
            <Card className="h-full gap-4 p-5 shadow-none transition hover:border-blue-500/60 dark:hover:border-blue-400/60">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-300">
                  <Music4 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
                    {pattern.name}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Updated {new Date(pattern.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {pattern.description && (
                <p className="line-clamp-2 text-sm leading-6 text-zinc-500">
                  {pattern.description}
                </p>
              )}
              <pre className="max-h-40 overflow-hidden rounded-lg bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-800">
                {pattern.code}
              </pre>
              {pattern.tags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {pattern.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
