import type { PetOrigin, UserPet, UserPetsPage } from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource } from "./resource.js";

const pets = resource<UserPet>("/pets");

export function fetchUserPets(after?: string): Promise<UserPetsPage> {
  return pets.list({ after });
}

export function fetchUserPet(petId: string): Promise<UserPet> {
  return pets.get(petId);
}

export interface CreateUserPetInput {
  name: string;
  description?: string;
  prompt?: string;
  origin: PetOrigin;
  sheet: Blob;
  filename: string;
}

export function createUserPet(input: CreateUserPetInput): Promise<UserPet> {
  const formData = new FormData();

  formData.append("name", input.name);
  formData.append("origin", input.origin);
  formData.append("sheet", input.sheet, input.filename);

  if (input.description) {
    formData.append("description", input.description);
  }

  if (input.prompt) {
    formData.append("prompt", input.prompt);
  }

  return requestJson<UserPet>(pets.path, "POST", formData);
}

export function deleteUserPet(petId: string): Promise<void> {
  return pets.delete(petId);
}

export async function generatePetImage(prompt: string, name: string): Promise<string> {
  const { image } = await pets.collectionAction<{ image: string }>("generate", { name, prompt });

  return image;
}
