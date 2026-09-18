export const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

export const paginate = <Item>(items: Item[], pageSize: number): Item[][] => {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new RangeError("Page size must be a positive integer");
  }

  const pages: Item[][] = [];

  for (let start = 0; start < items.length; start += pageSize) {
    pages.push(items.slice(start, start + pageSize));
  }

  return pages;
};
