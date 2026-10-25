import type {
  GeneratedPetImage,
  GeneratedPetPoses,
  PetOrigin,
  UserPet,
  UserPetsPage,
} from "@ngriffin_uk/polychat-schemas";

import { requestBlob, requestJson, resource } from "./resource.js";

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
  layoutId: string;
  sheet: Blob;
  filename: string;
}

export function createUserPet(input: CreateUserPetInput): Promise<UserPet> {
  const formData = new FormData();

  formData.append("name", input.name);
  formData.append("origin", input.origin);
  formData.append("layout_id", input.layoutId);
  formData.append("sheet", input.sheet, input.filename);

  if (input.description) {
    formData.append("description", input.description);
  }

  if (input.prompt) {
    formData.append("prompt", input.prompt);
  }

  return requestJson<UserPet>(pets.path, "POST", formData);
}

export function importUserPet(url: string): Promise<UserPet> {
  return pets.collectionAction<UserPet>("import", { url });
}

export function fetchUserPetSheet(petId: string): Promise<Blob> {
  return requestBlob(`${pets.path}/${encodeURIComponent(petId)}/sheet`);
}

export function deleteUserPet(petId: string): Promise<void> {
  return pets.delete(petId);
}

export function generatePetImage(prompt: string, name: string): Promise<GeneratedPetImage> {
  return pets.collectionAction<GeneratedPetImage>("generate", { name, prompt });
}

export function generatePetPoses(prompt: string, seed: number): Promise<GeneratedPetPoses> {
  return pets.collectionAction<GeneratedPetPoses>("poses", { prompt, seed });
}
