import { createPolychatClient, type FetchApiOptions } from "@ngriffin_uk/polychat-library-client";

import { API_BASE_URL } from "~/constants";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  return parts.length === 2 ? (parts.pop()?.split(";").shift() ?? null) : null;
}

const webClient = createPolychatClient({
  baseUrl: API_BASE_URL,
  fetch: (input, init) => globalThis.fetch(input, init),
  credentials: "include",
  getCsrfToken: () => getCookie("_csrf"),
});

export function fetchApi(path: string, options: FetchApiOptions = {}): Promise<Response> {
  return webClient.fetch(path, options);
}

export function fetchApiOrThrow(path: string, options: FetchApiOptions = {}): Promise<Response> {
  return webClient.fetchOrThrow(path, options);
}
