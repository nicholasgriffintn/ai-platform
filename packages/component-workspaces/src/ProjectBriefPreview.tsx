import { TextLink } from "@ngriffin_uk/polychat-component-ui";
import { ArrowRight } from "lucide-react";

export interface ProjectBriefPreviewProps {
  instructions: string;
  settingsHref: string;
  canManage: boolean;
}

export function ProjectBriefPreview({
  instructions,
  settingsHref,
  canManage,
}: ProjectBriefPreviewProps) {
  const brief = instructions.trim();

  return (
    <section aria-labelledby="project-brief-preview-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="project-brief-preview-title" className="text-sm font-semibold text-foreground">
          Brief
        </h2>
        {canManage || brief ? (
          <TextLink href={settingsHref} size="xs" trailingIcon={<ArrowRight size={13} />}>
            {canManage ? (brief ? "Edit" : "Write a brief") : "View"}
          </TextLink>
        ) : null}
      </div>
      <p className="line-clamp-5 rounded-lg border border-border bg-surface p-3 text-sm whitespace-pre-line text-muted-foreground">
        {brief ||
          "No brief yet. A brief tells every teammate in this project what it is for and how to work."}
      </p>
    </section>
  );
}
