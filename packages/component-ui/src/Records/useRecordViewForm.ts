import {
  nativeRecordViewSchema,
  type NativeRecordTable,
  type NativeRecordView,
  type NativeRecordFilter,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function useRecordViewForm(table: NativeRecordTable, initial?: NativeRecordView) {
  const [id] = useState(initial?.id ?? `view_${generateId().replaceAll("-", "")}`);
  const [title, setTitle] = useState(initial?.title ?? table.output.title);
  const [editable, setEditable] = useState(initial?.editable ?? false);
  const [presentation, setPresentation] = useState(initial?.presentation ?? "table");
  const [groupColumnId, setGroupColumnId] = useState(
    initial?.groupColumnId ??
      table.definition.columns.find((column) => column.type === "select")?.id ??
      "",
  );
  const [checkedColumnId, setCheckedColumnId] = useState(
    initial?.checkedColumnId ??
      table.definition.columns.find((column) => column.type === "boolean")?.id ??
      "",
  );
  const [columns, setColumns] = useState(
    initial?.columns ?? table.definition.columns.map((column) => column.id),
  );
  const [sortColumnId, setSortColumnId] = useState(initial?.query.sort?.columnId ?? "");
  const [direction, setDirection] = useState(initial?.query.sort?.direction ?? "asc");
  const [filters, setFilters] = useState<NativeRecordFilter[]>(initial?.query.filters ?? []);
  const addFilter = () => {
    const column = table.definition.columns[0];

    if (column) {
      setFilters((current) => [...current, { columnId: column.id, operator: "is_empty" }]);
    }
  };

  const replaceFilter = (index: number, filter: NativeRecordFilter) =>
    setFilters((current) => current.map((item, position) => (position === index ? filter : item)));
  const removeFilter = (index: number) =>
    setFilters((current) => current.filter((_item, position) => position !== index));
  const toggleColumn = (columnId: string, include: boolean) =>
    setColumns((current) =>
      include ? [...current, columnId] : current.filter((column) => column !== columnId),
    );
  const parsed = nativeRecordViewSchema.safeParse({
    id,
    tableId: table.output.id,
    title,
    presentation,
    editable,
    columns,
    groupColumnId: groupColumnId || undefined,
    checkedColumnId: checkedColumnId || undefined,
    query: { filters, sort: sortColumnId ? { columnId: sortColumnId, direction } : undefined },
  });

  return {
    title,
    setTitle,
    editable,
    setEditable,
    presentation,
    setPresentation,
    groupColumnId,
    setGroupColumnId,
    checkedColumnId,
    setCheckedColumnId,
    columns,
    toggleColumn,
    sortColumnId,
    setSortColumnId,
    direction,
    setDirection,
    filters,
    addFilter,
    replaceFilter,
    removeFilter,
    parsed,
  };
}
