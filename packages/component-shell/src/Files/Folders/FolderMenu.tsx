import {
  Button,
  OptionsMenu,
  OptionsMenuAction,
  OptionsMenuSeparator,
  OptionsMenuSubmenu,
} from "@ngriffin_uk/polychat-component-ui";
import { useFolderActions } from "@ngriffin_uk/polychat-library-react";
import {
  folderStudioRequestSchema,
  READING_FORMS,
  type ReadingFormId,
  type SourceCollection,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Check, FileText, MoreHorizontal, ScanText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NotebookStudioDialog } from "../../Notebooks/NotebookStudioDialog.js";
import { STUDIO_TILES } from "../../Notebooks/studio-kinds.js";
import { folderToFileItem } from "../Library/file-items.js";
import { FileItemMenuItems } from "../Library/FileItemMenu.js";
import type { FileActions } from "../Library/useFileActions.js";

const REPORT_TILE = STUDIO_TILES.find((tile) => tile.kind === "report");
const FORMS = Object.values(READING_FORMS);

export function FolderMenu({
  folder,
  folders,
  basePath,
  actions,
}: {
  folder: SourceCollection;
  folders: SourceCollection[];
  basePath: string;
  actions: FileActions;
}) {
  const folderActions = useFolderActions(folder.id);
  const [isMakingReport, setIsMakingReport] = useState(false);
  const isGeneral = folder.kind === "general";

  const readAs = (form: ReadingFormId | null) =>
    folderActions.update.mutate(
      { readAs: form },
      {
        onSuccess: () =>
          toast.success(
            form
              ? `Every file here will be read as a ${READING_FORMS[form].singular}`
              : "Files here won't be read any more",
          ),
        onError: (error) => toast.error(getErrorMessage(error, "That didn't change")),
      },
    );

  return (
    <>
      <OptionsMenu
        align="end"
        trigger={
          <Button
            variant="icon"
            size="icon"
            icon={<MoreHorizontal size={16} />}
            aria-label={`More for ${folder.title}`}
          />
        }
      >
        {isGeneral && REPORT_TILE ? (
          <>
            <OptionsMenuAction
              disabled={folder.sourceCount === 0}
              onSelect={() => setIsMakingReport(true)}
            >
              <FileText size={14} aria-hidden="true" />
              Make a report…
            </OptionsMenuAction>
            <OptionsMenuSubmenu
              trigger={
                <span className="flex items-center gap-4">
                  <ScanText size={14} aria-hidden="true" />
                  Read files as
                </span>
              }
            >
              {FORMS.map((form) => (
                <OptionsMenuAction key={form.id} onSelect={() => readAs(form.id)}>
                  <Check
                    size={14}
                    aria-hidden="true"
                    className={folder.readAs === form.id ? "opacity-100" : "opacity-0"}
                  />
                  {form.label}
                </OptionsMenuAction>
              ))}
              <OptionsMenuSeparator />
              <OptionsMenuAction disabled={!folder.readAs} onSelect={() => readAs(null)}>
                <Check size={14} aria-hidden="true" className="opacity-0" />
                Don't read them
              </OptionsMenuAction>
            </OptionsMenuSubmenu>
            <OptionsMenuSeparator />
          </>
        ) : null}
        <FileItemMenuItems
          item={folderToFileItem(folder, basePath)}
          actions={actions}
          folders={folders}
        />
      </OptionsMenu>
      {isMakingReport && REPORT_TILE ? (
        <NotebookStudioDialog
          tile={REPORT_TILE}
          sourceCount={folder.sourceCount}
          isStarting={folderActions.studio.isPending}
          onOpenChange={(open) => !open && setIsMakingReport(false)}
          onStart={async (request) => {
            try {
              await folderActions.studio.mutateAsync(folderStudioRequestSchema.parse(request));
              setIsMakingReport(false);
              toast.success("Writing the report. It lands in this folder when it's ready.");
            } catch (error) {
              toast.error(getErrorMessage(error, "The report didn't start"));
            }
          }}
        />
      ) : null}
    </>
  );
}
