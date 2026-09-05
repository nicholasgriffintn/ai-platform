export function getMemoryCategoryClassName(category: string | null | undefined): string {
  switch (category) {
    case "fact":
      return "bg-active-work/12 text-active-work";
    case "preference":
      return "bg-success/12 text-success";
    case "schedule":
      return "bg-attention/12 text-attention";
    default:
      return "bg-surface-elevated text-foreground";
  }
}

export function formatMemoryDate(value: string | null | undefined): string | undefined {
  return value ? new Date(value).toLocaleDateString() : undefined;
}
