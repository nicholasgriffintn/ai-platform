import type { AgeGateResponse } from "@ngriffin_uk/polychat-schemas";

import { fetchApiData } from "./fetch-wrapper.js";

export function getAgeGate(): Promise<AgeGateResponse> {
  return fetchApiData<AgeGateResponse>("/auth/age", { method: "GET" });
}

export function confirmAge(birthDate: string): Promise<AgeGateResponse> {
  return fetchApiData<AgeGateResponse>("/auth/age", {
    method: "POST",
    body: { birth_date: birthDate },
  });
}
