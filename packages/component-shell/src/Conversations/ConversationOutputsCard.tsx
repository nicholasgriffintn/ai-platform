import { isCodeArtifact } from "@ngriffin_uk/polychat-component-content";
import { WorkbenchCard, cn } from "@ngriffin_uk/polychat-component-ui";
import type { ConversationArtifactSummary } from "@ngriffin_uk/polychat-library-chat/conversation-insights";
import { useArtifactWorkbench, useConversationBrief } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { FileCode2, FileText, NotebookPen, Package, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

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
  briefUpdated,
  onOpenBrief,
}: {
  conversationId: string;
  artifacts: readonly ConversationArtifactSummary[];
  briefUpdated: boolean;
  onOpenBrief: () => void;
}) {
  const brief = useConversationBrief(conversationId);
  const workbench = useArtifactWorkbench();
  const document = brief.data?.document ?? undefined;
  const openIdentifier = workbench.isPanelVisible
    ? workbench.currentArtifact?.identifier
    : undefined;
  const hasBriefRow = !brief.isAwaitingRemoteConversation && !brief.isLoading;
  const isEmpty = artifacts.length === 0 && !document;

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
        {hasBriefRow ? (
          <OutputRow
            icon={NotebookPen}
            label={document ? "Conversation brief" : "Start a brief"}
            meta={
              document ? (
                <span className="flex items-center gap-1.5">
                  {briefUpdated ? (
                    <span className="rounded bg-creative/12 px-1 text-creative">new</span>
                  ) : null}
                  r{document.revision}
                </span>
              ) : undefined
            }
            onClick={() => {
              if (document) {
                onOpenBrief();

                return;
              }

              void brief.ensure
                .mutateAsync()
                .then(onOpenBrief)
                .catch((error: unknown) => {
                  toast.error(getErrorMessage(error, "Unable to start this conversation brief"));
                });
            }}
          />
        ) : null}
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
      {isEmpty ? (
        <p className="mt-1">
          Nothing made yet. Ask for a document, some code or a plan and it lands here.
        </p>
      ) : null}
    </WorkbenchCard>
  );
}
