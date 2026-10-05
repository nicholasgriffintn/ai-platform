import { useSaveDocumentRevision } from "@ngriffin_uk/polychat-library-react";
import {
  readDocumentBody,
  readDocumentMetadata,
  readDocumentRecordViews,
  type NativeRecordView,
  type Output,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

interface ViewEditorState {
  base: Output;
  tableId: string;
  initialView?: NativeRecordView;
}

export function useDocumentRecordViews(output: Output) {
  const save = useSaveDocumentRevision();
  const [editor, setEditor] = useState<ViewEditorState | null>(null);
  const open = (initialView?: NativeRecordView) => {
    save.reset();
    setEditor({ base: output, tableId: initialView?.tableId ?? "", initialView });
  };

  const saveViews = async (base: Output, views: NativeRecordView[]) => {
    const body = readDocumentBody(base.content);

    if (body === null) {
      return false;
    }

    try {
      await save.mutateAsync({
        outputId: base.id,
        body,
        metadata: readDocumentMetadata(base.content) ?? undefined,
        recordViews: views,
        expectedRevision: base.revision,
      });

      return true;
    } catch {
      return false;
    }
  };

  const attach = async (view: NativeRecordView) => {
    if (!editor) {
      return false;
    }

    const existing = readDocumentRecordViews(editor.base.content);
    const views = editor.initialView
      ? existing.map((item) => (item.id === editor.initialView?.id ? view : item))
      : [...existing, view];

    if (await saveViews(editor.base, views)) {
      setEditor(null);

      return true;
    }

    return false;
  };

  const remove = (viewId: string) =>
    saveViews(
      output,
      readDocumentRecordViews(output.content).filter((view) => view.id !== viewId),
    );

  return { save, editor, setEditor, open, attach, remove };
}
