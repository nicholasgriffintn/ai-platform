export function areUserIdsEqual(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): boolean {
  return left !== null && left !== undefined && right !== null && right !== undefined
    ? String(left) === String(right)
    : false;
}
