export function getSearchStatusMessage({
  resultCount,
  isLoading,
  hasError,
}: {
  resultCount: number;
  isLoading: boolean;
  hasError: boolean;
}): string {
  if (resultCount > 0) {
    return `${resultCount} ${resultCount === 1 ? "result" : "results"} available`;
  }

  if (isLoading) {
    return "Searching Polychat";
  }

  if (hasError) {
    return "Search is temporarily unavailable";
  }

  return "No matches found";
}
