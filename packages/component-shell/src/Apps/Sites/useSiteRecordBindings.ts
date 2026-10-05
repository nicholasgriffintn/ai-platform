import { sitesService } from "@ngriffin_uk/polychat-library-client";
import { SITES_QUERY_KEYS } from "@ngriffin_uk/polychat-library-react";
import { buildSiteRecordBindingPatches } from "@ngriffin_uk/polychat-library-sites";
import type { NativeRecordView, SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function useSiteRecordBindings(
  site: SiteRecord,
  pageId: string | null,
  onSaved: (site: SiteRecord) => void,
) {
  const client = useQueryClient();
  const [editor, setEditor] = useState<{
    base: SiteRecord;
    pageId: string | null;
    tableId: string;
    initialView?: NativeRecordView;
  } | null>(null);
  const save = useMutation({
    mutationFn: async ({
      base,
      views,
      insertView,
      targetPageId,
    }: {
      base: SiteRecord;
      views: NativeRecordView[];
      insertView?: NativeRecordView;
      targetPageId?: string;
    }) =>
      sitesService.edit(base.id, {
        projectId: base.projectId ?? undefined,
        expectedRevision: base.revision,
        patches: buildSiteRecordBindingPatches(base.project, views, targetPageId, insertView),
        summary: "Updated live record views",
      }),
    onSuccess: (saved) => {
      client.setQueryData(SITES_QUERY_KEYS.detail(saved.projectId ?? undefined, saved.id), saved);
      void client.invalidateQueries({
        queryKey: SITES_QUERY_KEYS.list(saved.projectId ?? undefined),
      });
      onSaved(saved);
    },
  });
  const open = (initialView?: NativeRecordView) => {
    save.reset();
    setEditor({ base: site, pageId, tableId: initialView?.tableId ?? "", initialView });
  };

  const attach = async (view: NativeRecordView) => {
    if (!editor) {
      return false;
    }

    const existing = editor.base.project.recordViews ?? [];
    const views = editor.initialView
      ? existing.map((item) => (item.id === editor.initialView?.id ? view : item))
      : [...existing, view];

    try {
      await save.mutateAsync({
        base: editor.base,
        views,
        insertView: editor.initialView ? undefined : view,
        targetPageId: editor.pageId ?? undefined,
      });
      setEditor(null);

      return true;
    } catch {
      return false;
    }
  };

  const remove = async (viewId: string) => {
    try {
      await save.mutateAsync({
        base: site,
        views: (site.project.recordViews ?? []).filter((view) => view.id !== viewId),
      });
    } catch {
      return;
    }
  };

  return { editor, setEditor, save, open, attach, remove };
}
