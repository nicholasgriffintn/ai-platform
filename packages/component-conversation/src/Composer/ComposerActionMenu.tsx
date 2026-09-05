import {
  Button,
  OptionsMenu,
  OptionsMenuAction,
  OptionsMenuSeparator,
  OptionsMenuSubmenu,
  ShortcutTooltip,
  cn,
  useMediaQuery,
} from "@ngriffin_uk/polychat-component-ui";
import type { ComposerDirectiveQuery } from "@ngriffin_uk/polychat-library-chat/composer-commands";
import type { SourceSummary } from "@ngriffin_uk/polychat-schemas";
import { Database, FileText, Loader2, Plus, Volume1, Volume2, VolumeX, Wrench } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import {
  AssistantActionItemIcon,
  describeAssistantActionItem,
  groupAssistantActionItems,
} from "./assistantActionPresentation";
import { useComposerCommandActions } from "./commandActions";
import { getComposerActionMenuLayout } from "./composerActionMenuLayout";
import { ComposerActionMenuMobile } from "./ComposerActionMenuMobile";
import {
  composerActionMenuRowClassName as menuRowClassName,
  ComposerActionMenuRow as MenuRow,
} from "./ComposerActionMenuRow";

interface ComposerActionMenuProps {
  autoPlayResponses?: {
    enabled: boolean;
    isGenerating: boolean;
    isPlaying: boolean;
    onToggle: () => void;
  };
  attachingSourceId?: string | null;
  canAttachSources?: boolean;
  canUploadFiles: boolean;
  directive?: ComposerDirectiveQuery | null;
  isDisabled?: boolean;
  isLoadingSources?: boolean;
  isUploading: boolean;
  onUploadClick: () => void;
  onAttachSource?: (sourceId: string) => boolean | Promise<boolean>;
  sourceScopeLabel?: string;
  sources?: SourceSummary[];
  tools?: ReactNode;
  uploadIcon: ReactNode;
  uploadLabel: string;
}

const submenuClassName = "w-80 max-w-[calc(100vw-1rem)] rounded-xl p-2 text-sm";
const EMPTY_SOURCES: SourceSummary[] = [];

function wrapAddMenuTrigger(trigger: ReactNode, isOpen?: boolean) {
  return (
    <ShortcutTooltip disabled={isOpen} keys={["@", "or", "/"]} label="Add">
      {trigger}
    </ShortcutTooltip>
  );
}

export function ComposerActionMenu({
  autoPlayResponses,
  attachingSourceId,
  canAttachSources = false,
  canUploadFiles,
  directive,
  isDisabled = false,
  isLoadingSources = false,
  isUploading,
  onUploadClick,
  onAttachSource,
  sourceScopeLabel = "Sources",
  sources = EMPTY_SOURCES,
  tools,
  uploadIcon,
  uploadLabel,
}: ComposerActionMenuProps) {
  const { actionItems, canUseAgents, isLoadingAgents, selectActionItem, selectedAgent } =
    useComposerCommandActions();
  const [isOpen, setIsOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const [alignOffset, setAlignOffset] = useState(0);
  const [sideOffset, setSideOffset] = useState(10);
  const usesDrilldownNavigation = useMediaQuery(
    "(max-width: 1279px), (hover: none), (pointer: coarse)",
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuActionItems = tools ? actionItems.filter((item) => item.kind !== "tool") : actionItems;
  const actionGroups = groupAssistantActionItems(menuActionItems);
  const toolGroup = actionGroups.find((group) => group.label === "Tools");
  const capabilityGroups = actionGroups.filter((group) => group.label !== "Tools");
  const hasActions =
    Boolean(directive) ||
    canUploadFiles ||
    canAttachSources ||
    Boolean(autoPlayResponses) ||
    Boolean(tools) ||
    (canUseAgents && (isLoadingAgents || actionGroups.length > 0));
  const isDirectiveOpen = Boolean(directive) && !isDisabled;
  const menuIsOpen = isDirectiveOpen || isOpen;

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const shell = trigger?.closest<HTMLElement>("[data-chat-input-shell]");

    if (!trigger || !shell || !isOpen) {
      return undefined;
    }

    const updateLayout = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const layout = getComposerActionMenuLayout(triggerRect, shellRect);

      setMenuWidth(layout.width);
      setAlignOffset(layout.alignOffset);
      setSideOffset(layout.sideOffset);
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);

    observer.observe(shell);

    return () => observer.disconnect();
  }, [isOpen]);

  if (!hasActions) {
    return null;
  }

  const handleSourceSelect = (sourceId: string) => {
    if (onAttachSource) {
      void onAttachSource(sourceId);
    }
  };

  return (
    <OptionsMenu
      trigger={
        <Button
          ref={triggerRef}
          type="button"
          variant={menuIsOpen ? "iconActive" : "icon"}
          className="h-8 w-8 shrink-0 p-1.5"
          aria-label="Add files or capabilities"
          aria-keyshortcuts="/ @"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      }
      triggerWrapper={wrapAddMenuTrigger}
      triggerWrapperActive={menuIsOpen}
      align="end"
      alignOffset={alignOffset}
      side="top"
      sideOffset={sideOffset}
      className="max-w-[calc(100vw-1rem)] rounded-xl p-2 text-sm"
      contentStyle={menuWidth ? { width: menuWidth } : undefined}
      modal={false}
      open={isOpen && !isDirectiveOpen}
      onOpenChange={setIsOpen}
    >
      {usesDrilldownNavigation ? (
        <ComposerActionMenuMobile
          actionItems={canUseAgents ? menuActionItems : []}
          attachingSourceId={attachingSourceId}
          autoPlayResponses={autoPlayResponses}
          canAttachSources={canAttachSources}
          canUploadFiles={canUploadFiles}
          isDisabled={isDisabled}
          isLoadingActions={isLoadingAgents}
          isLoadingSources={isLoadingSources}
          isUploading={isUploading}
          onAttachSource={handleSourceSelect}
          onSelectActionItem={selectActionItem}
          onUploadClick={onUploadClick}
          selectedAgentId={selectedAgent?.id}
          sourceScopeLabel={sourceScopeLabel}
          sources={sources}
          tools={tools}
          uploadIcon={uploadIcon}
          uploadLabel={uploadLabel}
        />
      ) : (
        <>
          {canUploadFiles ? (
            <OptionsMenuAction
              className={menuRowClassName}
              disabled={isDisabled || isUploading}
              onSelect={onUploadClick}
            >
              <MenuRow
                icon={isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : uploadIcon}
                label="Attach file"
                description={uploadLabel}
              />
            </OptionsMenuAction>
          ) : null}

          {canAttachSources ? (
            <OptionsMenuSubmenu
              className={menuRowClassName}
              contentClassName={cn(submenuClassName, "max-h-80 overflow-y-auto")}
              trigger={
                <MenuRow
                  icon={<Database className="h-5 w-5" />}
                  label="Attach source"
                  description={sourceScopeLabel}
                />
              }
            >
              {isLoadingSources ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading sources…
                </div>
              ) : sources.length > 0 ? (
                sources.map((source) => (
                  <OptionsMenuAction
                    key={source.id}
                    className={menuRowClassName}
                    disabled={Boolean(attachingSourceId)}
                    onSelect={() => handleSourceSelect(source.id)}
                  >
                    <MenuRow
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
                <p className="px-3 py-4 text-sm text-muted-foreground">No available sources.</p>
              )}
            </OptionsMenuSubmenu>
          ) : null}

          {(canUploadFiles || canAttachSources) &&
          (capabilityGroups.length > 0 || toolGroup || tools || autoPlayResponses) ? (
            <OptionsMenuSeparator />
          ) : null}

          {canUseAgents
            ? capabilityGroups.map((group) => {
                const GroupIcon = group.icon;

                return (
                  <OptionsMenuSubmenu
                    key={group.label}
                    className={menuRowClassName}
                    contentClassName={cn(submenuClassName, "max-h-80 overflow-y-auto")}
                    trigger={
                      <MenuRow icon={<GroupIcon className="h-5 w-5" />} label={group.label} />
                    }
                  >
                    {group.items.map((item) => (
                      <OptionsMenuAction
                        key={item.id}
                        className={menuRowClassName}
                        onSelect={() => selectActionItem(item)}
                      >
                        <MenuRow
                          icon={<AssistantActionItemIcon item={item} />}
                          label={item.label}
                          description={describeAssistantActionItem(item)}
                          isActive={item.id === `agent:${selectedAgent?.id}`}
                        />
                      </OptionsMenuAction>
                    ))}
                  </OptionsMenuSubmenu>
                );
              })
            : null}

          {isLoadingAgents && actionGroups.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading capabilities…
            </div>
          ) : null}

          {toolGroup || tools ? (
            <OptionsMenuSubmenu
              className={menuRowClassName}
              contentClassName={cn(submenuClassName, "max-h-96 overflow-y-auto")}
              trigger={<MenuRow icon={<Wrench className="h-5 w-5" />} label="Tools" />}
            >
              {toolGroup?.items.map((item) => (
                <OptionsMenuAction
                  key={item.id}
                  className={menuRowClassName}
                  onSelect={() => selectActionItem(item)}
                >
                  <MenuRow
                    icon={<AssistantActionItemIcon item={item} />}
                    label={item.label}
                    description={describeAssistantActionItem(item)}
                  />
                </OptionsMenuAction>
              ))}
              {toolGroup?.items.length && tools ? <OptionsMenuSeparator /> : null}
              {tools}
            </OptionsMenuSubmenu>
          ) : null}

          {autoPlayResponses ? (
            <>
              <OptionsMenuSeparator />
              <OptionsMenuAction
                className={menuRowClassName}
                disabled={isDisabled}
                onSelect={autoPlayResponses.onToggle}
              >
                <MenuRow
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
      )}
    </OptionsMenu>
  );
}
