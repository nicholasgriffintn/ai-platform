import {
  nativeRecordColumnSchema,
  nativeRecordDefinitionSchema,
  type NativeRecordColumn,
  type NativeRecordDefinition,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export const defaultRecordDefinition = nativeRecordDefinitionSchema.parse({
  format: "records",
  columns: [
    { id: "name", name: "Name", type: "text", required: true },
    {
      id: "status",
      name: "Status",
      type: "select",
      options: ["To do", "In progress", "Done"],
      required: true,
    },
  ],
});

export function useRecordDefinitionDraft(initial: NativeRecordDefinition) {
  const [definition, setDefinition] = useState(initial);
  const replaceColumn = (index: number, column: NativeRecordColumn) =>
    setDefinition((current) => ({
      ...current,
      columns: current.columns.map((item, position) => (position === index ? column : item)),
    }));
  const removeColumn = (index: number) =>
    setDefinition((current) => ({
      ...current,
      columns: current.columns.filter((_column, position) => position !== index),
    }));
  const addColumn = () =>
    setDefinition((current) => {
      let index = current.columns.length + 1;

      while (current.columns.some((column) => column.id === `column_${index}`)) {
        index += 1;
      }

      return {
        ...current,
        columns: [
          ...current.columns,
          nativeRecordColumnSchema.parse({
            id: `column_${index}`,
            name: `Column ${index}`,
            type: "text",
          }),
        ],
      };
    });
  const changeType = (index: number, type: string) => {
    const column = definition.columns[index];

    if (!column) {
      return;
    }

    const parsed = nativeRecordColumnSchema.safeParse({
      id: column.id,
      name: column.name,
      required: column.required,
      type,
      ...(type === "select" ? { options: ["To do", "Done"] } : {}),
    });

    if (parsed.success) {
      replaceColumn(index, parsed.data);
    }
  };

  return { definition, setDefinition, replaceColumn, removeColumn, addColumn, changeType };
}
