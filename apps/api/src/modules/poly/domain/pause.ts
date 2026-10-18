import { isPolyTeammateId, type TeammateContext } from "@ngriffin_uk/polychat-schemas";

export function isTeammateContextPaused(
  context: Pick<TeammateContext, "pausedUntil">,
  now: number,
): boolean {
  return context.pausedUntil !== null && Date.parse(context.pausedUntil) > now;
}

export function isPolyContextPaused(
  context: Pick<TeammateContext, "pausedUntil" | "teammateId">,
  now: number,
): boolean {
  return isPolyTeammateId(context.teammateId) && isTeammateContextPaused(context, now);
}
