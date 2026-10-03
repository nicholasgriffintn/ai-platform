import { findModelMaker, type ModelPolicyReference } from "@ngriffin_uk/polychat-schemas";

export function parseGatewayModelReference(reference: string): ModelPolicyReference | undefined {
  const separator = reference.indexOf("/");

  if (separator < 1 || separator === reference.length - 1) {
    return undefined;
  }

  const provider = reference.slice(0, separator);

  return {
    provider: findModelMaker(provider)?.providers[0] ?? provider,
    model: reference.slice(separator + 1),
  };
}
