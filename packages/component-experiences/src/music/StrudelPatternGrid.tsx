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
            <Card className="h-full gap-4 p-5 shadow-none transition hover:border-active-work/60">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-active-work/10 text-active-work">
                  <Music4 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-foreground group-hover:underline">
                    {pattern.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(pattern.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {pattern.description && (
                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {pattern.description}
                </p>
              )}
              <pre className="bg-surface-elevated text-muted-foreground max-h-40 overflow-hidden rounded-lg p-3 text-xs leading-relaxed">
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
