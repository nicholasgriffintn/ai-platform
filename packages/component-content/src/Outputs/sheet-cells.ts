import type { SheetCell, SheetColumn } from "@ngriffin_uk/polychat-schemas";
import { formatCurrencyAmount, formatPercentFraction } from "@ngriffin_uk/polychat-utility-core";

export function formatSheetCell(cell: SheetCell | undefined, column: SheetColumn): string {
  if (cell === undefined || cell === null || cell === "") {
    return "";
  }

  if (typeof cell === "boolean") {
    return cell ? "Yes" : "No";
  }

  if (typeof cell === "string") {
    if (column.type === "date") {
      const parsed = new Date(cell);

      return Number.isNaN(parsed.getTime())
        ? cell
        : parsed.toLocaleDateString("en-GB", { dateStyle: "medium" });
    }

    return cell;
  }

  switch (column.type) {
    case "currency":
      return formatCurrencyAmount(cell, column.currency ?? "GBP");
    case "percent":
      return formatPercentFraction(cell);
    default:
      return cell.toLocaleString("en-GB");
  }
}

export function isNumericSheetColumn(column: SheetColumn): boolean {
  return column.type === "number" || column.type === "currency" || column.type === "percent";
}
