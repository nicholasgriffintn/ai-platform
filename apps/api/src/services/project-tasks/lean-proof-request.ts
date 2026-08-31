import type { LeanProofRequest } from "@ngriffin_uk/polychat-schemas";

export function leanProofRequestsMatch(
  left: LeanProofRequest | undefined,
  right: LeanProofRequest | undefined,
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.objective === right.objective &&
    left.targetPaths.length === right.targetPaths.length &&
    left.targetPaths.every((path, index) => path === right.targetPaths[index]) &&
    left.declarations.length === right.declarations.length &&
    left.declarations.every((declaration, index) => declaration === right.declarations[index]) &&
    left.acceptanceCriteria.length === right.acceptanceCriteria.length &&
    left.acceptanceCriteria.every(
      (criterion, index) => criterion === right.acceptanceCriteria[index],
    )
  );
}
