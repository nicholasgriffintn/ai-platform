import {
  createApiErrorFromResponse,
  returnFetchedData,
} from "@ngriffin_uk/polychat-library-client";
import type { PetOrigin, UserPet, UserPetsPage } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

async function readHeaders(): Promise<Record<string, string>> {
  return await apiService.getHeaders();
}

export async function fetchUserPets(page = 1): Promise<UserPetsPage> {
  const params = new URLSearchParams({ page: String(page) });
  const response = await fetchApi(`/user/pets?${params.toString()}`, {
    method: "GET",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to load pets");
  }

  return await returnFetchedData<UserPetsPage>(response);
}

export async function fetchUserPet(petId: string): Promise<UserPet> {
  const response = await fetchApi(`/user/pets/${encodeURIComponent(petId)}`, {
    method: "GET",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to load the pet");
  }

  const data = await returnFetchedData<{ pet: UserPet }>(response);

  return data.pet;
}

export interface CreateUserPetInput {
  name: string;
  description?: string;
  prompt?: string;
  origin: PetOrigin;
  sheet: Blob;
  filename: string;
}

export async function createUserPet(input: CreateUserPetInput): Promise<UserPet> {
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

  const response = await fetchApi("/user/pets", {
    method: "POST",
    headers: await readHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to save the pet");
  }

  const data = await returnFetchedData<{ pet: UserPet }>(response);

  return data.pet;
}

export async function deleteUserPet(petId: string): Promise<void> {
  const response = await fetchApi(`/user/pets/${encodeURIComponent(petId)}`, {
    method: "DELETE",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to delete the pet");
  }
}

export async function generatePetImage(prompt: string, name: string): Promise<string> {
  const response = await fetchApi("/user/pets/generate", {
    method: "POST",
    headers: await readHeaders(),
    body: { name, prompt },
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to generate a pet");
  }

  const data = await returnFetchedData<{ image: string }>(response);

  return data.image;
}
