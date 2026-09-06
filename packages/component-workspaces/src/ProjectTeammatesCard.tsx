import { Card, TextLink } from "@ngriffin_uk/polychat-component-ui";
import { UsersRound } from "lucide-react";

interface ProjectTeammatesCardProps {
  capabilityCount: number;
  teammatesHref: string;
  embedded?: boolean;
}

export function ProjectTeammatesCard({
  capabilityCount,
  teammatesHref,
  embedded = false,
}: ProjectTeammatesCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-creative/12 p-2 text-creative">
          <UsersRound size={17} />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Teammates</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The teammates, apps, automations and tools this project can use.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pl-11">
        <p className="text-sm text-muted-foreground">{capabilityCount} enabled for this project</p>
        <TextLink href={teammatesHref}>Open teammates</TextLink>
      </div>
    </>
  );

  return embedded ? (
    <section className="space-y-4 border-t border-border p-5">{content}</section>
  ) : (
    <Card className="gap-4 p-5 shadow-none">{content}</Card>
  );
}
