import { OptionsMenuAction, OptionsMenuSeparator } from "@ngriffin_uk/polychat-component-ui";
import type { AssistantActionItem, SourceSummary } from "@ngriffin_uk/polychat-schemas";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Loader2,
  Volume1,
  Volume2,
  VolumeX,
  Wrench,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  AssistantActionItemIcon,
  describeAssistantActionItem,
  groupAssistantActionItems,
} from "./assistantActionPresentation";
import { composerActionMenuRowClassName, ComposerActionMenuRow } from "./ComposerActionMenuRow";

type MobileMenuPage =
  | { kind: "sources" }
  | { kind: "tools" }
  | { kind: "group"; label: string }
  | null;

interface ComposerActionMenuMobileProps {
  actionItems: AssistantActionItem[];
  attachingSourceId?: string | null;
  autoPlayResponses?: {
    enabled: boolean;
    isGenerating: boolean;
    isPlaying: boolean;
    onToggle: () => void;
  };
  canAttachSources: boolean;
  canUploadFiles: boolean;
  isDisabled: boolean;
  isLoadingActions: boolean;
  isLoadingSources: boolean;
  isUploading: boolean;
  onAttachSource: (sourceId: string) => void;
  onSelectActionItem: (item: AssistantActionItem) => void;
  onUploadClick: () => void;
  selectedAgentId?: string;
  sourceScopeLabel: string;
  sources: SourceSummary[];
  tools?: ReactNode;
  uploadIcon: ReactNode;
  uploadLabel: string;
}

function DrilldownRow({
  description,
  icon,
  label,
  onSelect,
}: {
  description?: string;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <OptionsMenuAction className={composerActionMenuRowClassName} keepOpen onSelect={onSelect}>
      <ComposerActionMenuRow description={description} icon={icon} label={label} />
      <ChevronRight className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
    </OptionsMenuAction>
  );
}

export function ComposerActionMenuMobile({
  actionItems,
  attachingSourceId,
  autoPlayResponses,
  canAttachSources,
  canUploadFiles,
  isDisabled,
  isLoadingActions,
  isLoadingSources,
  isUploading,
  onAttachSource,
  onSelectActionItem,
  onUploadClick,
  selectedAgentId,
  sourceScopeLabel,
  sources,
  tools,
  uploadIcon,
  uploadLabel,
}: ComposerActionMenuMobileProps) {
  const [page, setPage] = useState<MobileMenuPage>(null);
  const groups = groupAssistantActionItems(actionItems);
  const selectedGroup =
    page?.kind === "group" ? groups.find((group) => group.label === page.label) : undefined;

  if (page) {
    return (
      <div className="max-h-[min(28rem,60dvh)] overflow-y-auto">
        <OptionsMenuAction
          className={composerActionMenuRowClassName}
          keepOpen
          onSelect={() => setPage(null)}
        >
          <ComposerActionMenuRow
            icon={<ChevronLeft className="h-5 w-5" />}
            label={
              page.kind === "sources" ? "Sources" : page.kind === "tools" ? "Tools" : page.label
            }
            description="Back to add menu"
          />
        </OptionsMenuAction>
        <OptionsMenuSeparator />

        {page.kind === "sources" ? (
          isLoadingSources ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading sources…
            </div>
          ) : sources.length > 0 ? (
            sources.map((source) => (
              <OptionsMenuAction
                key={source.id}
                className={composerActionMenuRowClassName}
                disabled={Boolean(attachingSourceId)}
                onSelect={() => onAttachSource(source.id)}
              >
                <ComposerActionMenuRow
                  icon={
                    attachingSourceId === source.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )
                  }
                  label={source.title}
                  description={source.kind}
                />
              </OptionsMenuAction>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
              No available sources.
            </p>
          )
        ) : page.kind === "tools" || selectedGroup?.label === "Tools" ? (
          <>
            {(selectedGroup?.items ?? []).map((item) => (
              <OptionsMenuAction
                key={item.id}
                className={composerActionMenuRowClassName}
                onSelect={() => onSelectActionItem(item)}
              >
                <ComposerActionMenuRow
                  icon={<AssistantActionItemIcon item={item} />}
                  label={item.label}
                  description={describeAssistantActionItem(item)}
                />
              </OptionsMenuAction>
            ))}
            {(selectedGroup?.items.length ?? 0) > 0 && tools ? <OptionsMenuSeparator /> : null}
            {tools}
          </>
        ) : (
          selectedGroup?.items.map((item) => (
            <OptionsMenuAction
              key={item.id}
              className={composerActionMenuRowClassName}
              onSelect={() => onSelectActionItem(item)}
            >
              <ComposerActionMenuRow
                icon={<AssistantActionItemIcon item={item} />}
                label={item.label}
                description={describeAssistantActionItem(item)}
                isActive={item.id === `agent:${selectedAgentId}`}
              />
            </OptionsMenuAction>
          ))
        )}
      </div>
    );
  }

  return (
    <>
      {canUploadFiles ? (
        <OptionsMenuAction
          className={composerActionMenuRowClassName}
          disabled={isDisabled || isUploading}
          onSelect={onUploadClick}
        >
          <ComposerActionMenuRow
            icon={isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : uploadIcon}
            label="Attach file"
            description={uploadLabel}
          />
        </OptionsMenuAction>
      ) : null}

      {canAttachSources ? (
        <DrilldownRow
          icon={<Database className="h-5 w-5" />}
          label="Attach source"
          description={sourceScopeLabel}
          onSelect={() => setPage({ kind: "sources" })}
        />
      ) : null}

      {(canUploadFiles || canAttachSources) && (groups.length > 0 || tools || autoPlayResponses) ? (
        <OptionsMenuSeparator />
      ) : null}

      {groups.map((group) => {
        const GroupIcon = group.icon;

        return (
          <DrilldownRow
            key={group.label}
            icon={<GroupIcon className="h-5 w-5" />}
            label={group.label}
            onSelect={() => setPage({ kind: "group", label: group.label })}
          />
        );
      })}

      {tools && !groups.some((group) => group.label === "Tools") ? (
        <DrilldownRow
          icon={<Wrench className="h-5 w-5" />}
          label="Tools"
          onSelect={() => setPage({ kind: "tools" })}
        />
      ) : null}

      {isLoadingActions && groups.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading capabilities…
        </div>
      ) : null}

      {autoPlayResponses ? (
        <>
          <OptionsMenuSeparator />
          <OptionsMenuAction
            className={composerActionMenuRowClassName}
            disabled={isDisabled}
            onSelect={autoPlayResponses.onToggle}
          >
            <ComposerActionMenuRow
              icon={
                autoPlayResponses.isPlaying ? (
                  <Volume1 className="h-5 w-5" />
                ) : autoPlayResponses.isGenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : autoPlayResponses.enabled ? (
                  <Volume2 className="h-5 w-5" />
                ) : (
                  <VolumeX className="h-5 w-5" />
                )
              }
              label="Response audio"
              description={
                autoPlayResponses.enabled
                  ? "Play assistant replies automatically"
                  : "Assistant replies stay silent"
              }
              isActive={autoPlayResponses.enabled}
            />
          </OptionsMenuAction>
        </>
      ) : null}
    </>
  );
}
