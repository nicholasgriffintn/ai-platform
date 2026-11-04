import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

const CINEMA_TIMEOUT_MS = 15_000;
const CINEMA_USER_AGENT = "Mozilla/5.0 (compatible; Polychat/1.0)";

export type ScreeningPrecision = "exact" | "day";

export interface Cinema {
  siteId: string;
  name: string;
  bookingUrl: string | null;
}

export interface Screening {
  film: string;
  day: string;
  startsAt: string | null;
  precision: ScreeningPrecision;
  attributes: string[];
  bookingUrl: string | null;
}

export interface CinemaSource {
  id: "cineworld" | "picturehouse" | "vue";
  listCinemas: () => Promise<Cinema[]>;
  listScreenings: (cinema: Cinema, days: number) => Promise<Screening[]>;
}

type CinemaRequest = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

export function dayAfter(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export async function fetchCinemaResponse(
  url: string,
  init: CinemaRequest = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "accept-language": "en-GB,en;q=0.9",
      "user-agent": CINEMA_USER_AGENT,
      ...init.headers,
    },
    signal: AbortSignal.timeout(CINEMA_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `Cinema listing answered with ${response.status}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return response;
}

export async function fetchCinemaJson(url: string, init: CinemaRequest = {}): Promise<unknown> {
  const response = await fetchCinemaResponse(url, {
    ...init,
    headers: { accept: "application/json", ...init.headers },
  });

  return response.json();
}
