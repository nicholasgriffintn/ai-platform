import type { CreateTeammateInput } from "@ngriffin_uk/polychat-schemas";

export type TeammateFormData = Omit<CreateTeammateInput, "avatar_url"> & {
  avatar_url?: string;
};
