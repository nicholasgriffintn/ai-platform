import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { fetchJson } from "@ngriffin_uk/polychat-utility-server/http";

const TVMAZE_BASE_URL = "https://api.tvmaze.com";
const TVMAZE_TIMEOUT_MS = 10_000;

export interface TvmazeNextEpisode {
  airsAt: string;
  season: number | null;
  episode: number | null;
  name: string;
  network: string | null;
}

async function requestTvmaze(path: string): Promise<Record<string, unknown> | null> {
  const payload = await fetchJson(`${TVMAZE_BASE_URL}${path}`, {
    service: "TVmaze",
    timeoutMs: TVMAZE_TIMEOUT_MS,
  }).catch(() => null);

  return isRecord(payload) ? payload : null;
}

function readNetwork(show: Record<string, unknown>): string | null {
  const channel = isRecord(show.webChannel) ? show.webChannel : show.network;

  return isRecord(channel) && typeof channel.name === "string" ? channel.name : null;
}

export async function fetchTvmazeNextEpisode(imdbId: string): Promise<TvmazeNextEpisode | null> {
  const show = await requestTvmaze(`/lookup/shows?imdb=${encodeURIComponent(imdbId)}`);

  if (!show || typeof show.id !== "number") {
    return null;
  }

  const details = await requestTvmaze(`/shows/${show.id}?embed=nextepisode`);
  const embedded = isRecord(details?._embedded) ? details._embedded : {};
  const next = embedded.nextepisode;

  if (!isRecord(next) || typeof next.airstamp !== "string") {
    return null;
  }

  return {
    airsAt: next.airstamp,
    season: typeof next.season === "number" ? next.season : null,
    episode: typeof next.number === "number" ? next.number : null,
    name: typeof next.name === "string" ? next.name : "",
    network: readNetwork(show),
  };
}
