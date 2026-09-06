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
        <div className="bg-creative/12 text-creative rounded-lg p-2">
          <UsersRound size={17} />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Teammates</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            The teammates, apps, automations and tools this project can use.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pl-11">
        <p className="text-muted-foreground text-sm">{capabilityCount} enabled for this project</p>
        <TextLink href={teammatesHref}>Open teammates</TextLink>
      </div>
    </>
  );

  return embedded ? (
    <section className="border-border space-y-4 border-t p-5">{content}</section>
  ) : (
    <Card className="gap-4 p-5 shadow-none">{content}</Card>
  );
}
