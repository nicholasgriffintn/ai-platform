export type PetModelTargetKind = "maker" | "provider" | "family";

export interface PetModelTargetOption {
  kind: PetModelTargetKind;
  value: string;
  label: string;
  modelCount?: number;
  iconModelName?: string;
  iconProvider?: string;
}
