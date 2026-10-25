import { API_BASE_URL } from "./constants.js";

let mediaBaseUrl = API_BASE_URL;

export function setMediaBaseUrl(baseUrl: string): void {
  mediaBaseUrl = baseUrl;
}

export function apiMediaUrl(path: string): string {
  return `${mediaBaseUrl}${path}`;
}
