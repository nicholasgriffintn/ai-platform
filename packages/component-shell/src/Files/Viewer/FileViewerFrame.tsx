import { Viewer, type ViewerSidePanel } from "@ngriffin_uk/polychat-component-content";
import {
  Button,
  OptionsMenuAction,
  OptionsMenuSeparator,
} from "@ngriffin_uk/polychat-component-ui";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import {
  type FileTarget,
  useSourceCollections,
  useSubjectConversations,
} from "@ngriffin_uk/polychat-library-react";
import type { ConversationSubject } from "@ngriffin_uk/polychat-schemas";
import { History, Maximize2, MessageSquare, MessagesSquare, SquarePen } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import { LISTED_FOLDER_KINDS, type FileItem } from "../Library/file-items.js";
import { FileActionDialogs } from "../Library/FileActionDialogs.js";
import { FileItemMenuItems } from "../Library/FileItemMenu.js";
import { FileTypeIcon } from "../Library/FilePreview.js";
import type { FileActions } from "../Library/useFileActions.js";
import { FileAskPanel } from "./FileAskPanel.js";
import { FileConversationsList } from "./FileConversationsList.js";
import type { FileViewerDrawer, FileViewerPanels } from "./useFileViewerPanels.js";

export interface FileViewerDrawerEntry {
  key: Exclude<FileViewerDrawer, "conversations">;
  label: string;
  detail?: string;
  icon: ReactNode;
  content: ReactNode;
  quick?: boolean;
}

export interface FileViewerChrome {
  fullPageHref?: string;
  onClose: () => void;
  onOpenFile: (target: FileTarget) => void;
}

function buildSidePanel({
  panels,
  drawers,
  subject,
  item,
  projectId,
  askAttachment,
}: {
  panels: FileViewerPanels;
  item: FileItem;
  drawers: FileViewerDrawerEntry[];
  subject: ConversationSubject;
  projectId?: string;
  askAttachment?: AttachmentData;
}): ViewerSidePanel | null {
  if (panels.drawer === "conversations") {
    return {
      title: "Conversations about this file",
      onClose: panels.closeDrawer,
      content: <FileConversationsList subject={subject} onResume={panels.resumeConversation} />,
    };
  }

  const entry = drawers.find((candidate) => candidate.key === panels.drawer);

  if (entry) {
    return { title: entry.label, content: entry.content, onClose: panels.closeDrawer };
  }

  if (!panels.isAsking) {
    return null;
  }

  return {
    title: "Ask about this file",
    fill: true,
    onClose: panels.hideAsking,
    actions: (
      <>
        <Button
          variant="icon"
          size="sm"
          icon={<History size={15} />}
          aria-label="Earlier conversations about this file"
          title="Earlier conversations"
          onClick={() => panels.openDrawer("conversations")}
        />
        <Button
          variant="icon"
          size="sm"
          icon={<SquarePen size={15} />}
          aria-label="New conversation about this file"
          title="New conversation"
          onClick={panels.startConversation}
        />
      </>
    ),
    content: (
      <FileAskPanel
        key={panels.conversation.key}
        subject={subject}
        item={item}
        projectId={projectId}
        conversation={panels.conversation}
        attachment={askAttachment}
      />
    ),
  };
}

export function FileViewerFrame({
  item,
  subject,
  location,
  projectId,
  panels,
  actions,
  drawers,
  stage,
  toolbar,
  headerActions,
  askAttachment,
  chrome,
}: {
  item: FileItem;
  subject: ConversationSubject;
  location: string;
  projectId?: string;
  panels: FileViewerPanels;
  actions: FileActions;
  drawers: FileViewerDrawerEntry[];
  stage: ReactNode;
  toolbar?: ReactNode;
  headerActions?: ReactNode;
  askAttachment?: AttachmentData;
  chrome: FileViewerChrome;
}) {
  const navigate = useNavigate();
  const { data: folders } = useSourceCollections(projectId, { kinds: LISTED_FOLDER_KINDS });
  const conversations = useSubjectConversations(subject);
  const conversationCount = conversations.data?.length ?? 0;

  return (
    <>
      <Viewer
        title={item.title}
        icon={<FileTypeIcon type={item.type} />}
        location={location}
        detail={item.detail}
        stage={stage}
        toolbar={toolbar}
        onClose={chrome.onClose}
        side={buildSidePanel({
          panels,
          drawers,
          subject,
          item,
          projectId,
          askAttachment,
        })}
        menu={
          <>
            {drawers.map((entry) => (
              <OptionsMenuAction key={entry.key} onSelect={() => panels.openDrawer(entry.key)}>
                {entry.icon}
                <span className="flex-1">{entry.label}</span>
                {entry.detail ? (
                  <span className="text-xs text-muted-foreground tabular-nums">{entry.detail}</span>
                ) : null}
              </OptionsMenuAction>
            ))}
            <OptionsMenuAction onSelect={() => panels.openDrawer("conversations")}>
              <MessagesSquare size={14} aria-hidden="true" />
              <span className="flex-1">Conversations</span>
              {conversationCount > 0 ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {conversationCount}
                </span>
              ) : null}
            </OptionsMenuAction>
            <OptionsMenuSeparator />
            <FileItemMenuItems item={item} actions={actions} folders={folders ?? []} />
          </>
        }
        actions={
          <>
            {headerActions}
            {drawers
              .filter((entry) => entry.quick)
              .map((entry) => {
                const isOpen = panels.drawer === entry.key;

                return (
                  <Button
                    key={entry.key}
                    variant={isOpen ? "iconActive" : "icon"}
                    size="sm"
                    icon={entry.icon}
                    aria-label={entry.label}
                    aria-pressed={isOpen}
                    title={entry.label}
                    onClick={() => (isOpen ? panels.closeDrawer() : panels.openDrawer(entry.key))}
                    className="hidden sm:inline-flex"
                  />
                );
              })}
            {panels.isAsking && !panels.drawer ? null : (
              <Button
                variant="icon"
                size="sm"
                icon={<MessageSquare size={15} />}
                aria-label="Ask about this file"
                title="Ask about this file"
                onClick={panels.drawer ? panels.showAsking : panels.toggleAsking}
              />
            )}
            {chrome.fullPageHref ? (
              <Button
                variant="icon"
                size="sm"
                icon={<Maximize2 size={15} />}
                aria-label="Show in Files"
                onClick={() => {
                  const href = chrome.fullPageHref;

                  chrome.onClose();

                  if (href) {
                    void navigate(href);
                  }
                }}
              />
            ) : null}
          </>
        }
      />
      <FileActionDialogs actions={actions} />
    </>
  );
}
