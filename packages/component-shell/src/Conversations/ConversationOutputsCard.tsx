import { isCodeArtifact } from "@ngriffin_uk/polychat-component-content";
import { WorkbenchCard, cn } from "@ngriffin_uk/polychat-component-ui";
import type { ConversationArtifactSummary } from "@ngriffin_uk/polychat-library-chat/conversation-insights";
import { useArtifactWorkbench } from "@ngriffin_uk/polychat-library-react";
import { FileCode2, FileText, Package, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

function OutputRow({
  icon: Icon,
  label,
  meta,
  active = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  meta?: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "polychat-motion-micro -mx-1.5 flex min-h-7 w-[calc(100%+0.75rem)] items-center gap-2 rounded-md px-1.5 text-left hover:bg-selection focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          active && "bg-selection",
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span
          className={cn("min-w-0 flex-1 truncate text-foreground", active && "text-active-work")}
        >
          {label}
        </span>
        {meta ? <span className="shrink-0 font-mono text-[11px] tabular-nums">{meta}</span> : null}
      </button>
    </li>
  );
}

export function ConversationOutputsCard({
  conversationId,
  artifacts,
}: {
  conversationId: string;
  artifacts: readonly ConversationArtifactSummary[];
}) {
  const workbench = useArtifactWorkbench();
  const openIdentifier = workbench.isPanelVisible
    ? workbench.currentArtifact?.identifier
    : undefined;

  return (
    <WorkbenchCard
      title="Outputs"
      icon={Package}
      aside={
        artifacts.length > 0 ? (
          <span className="font-mono text-[11px] tabular-nums">{artifacts.length}</span>
        ) : undefined
      }
    >
      <ul className="space-y-0.5">
        {artifacts.map((artifact) => (
          <OutputRow
            key={artifact.identifier}
            icon={isCodeArtifact(artifact) ? FileCode2 : FileText}
            label={artifact.title ?? artifact.identifier}
            active={openIdentifier === artifact.identifier}
            meta={artifact.revisions > 1 ? `v${artifact.revisions}` : undefined}
            onClick={() =>
              workbench.openArtifact({
                identifier: artifact.identifier,
                type: artifact.type,
                language: artifact.language,
                title: artifact.title,
                content: artifact.content,
                source: { conversationId, messageId: artifact.messageId },
              })
            }
          />
        ))}
      </ul>
      {artifacts.length === 0 ? (
        <p className="mt-1">
          Nothing made yet. Ask for a document, some code or a plan and it lands here.
        </p>
      ) : null}
    </WorkbenchCard>
  );
}
