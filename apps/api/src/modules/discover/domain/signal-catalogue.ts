import {
  epochSecondsToIso,
  isoDaysBefore,
  isRecord,
  readPathValues,
  shiftCalendarDate,
} from "@ngriffin_uk/polychat-utility-core";
import { htmlToPlainText } from "@ngriffin_uk/polychat-utility-server/html-text";

import type { DiscoverResearchResult } from "./research";

export type DiscoverSignalGroup =
  | "listening"
  | "reading"
  | "watching"
  | "fitness"
  | "calendar"
  | "mail"
  | "tasks"
  | "work"
  | "places"
  | "pictures"
  | "models"
  | "social"
  | "playing";

export interface DiscoverSignalRead {
  date: string;
  timezone: string;
  now: Date;
  location: string | null;
}

export interface DiscoverSignal {
  id: string;
  providerId: string;
  group: DiscoverSignalGroup;
  title: string;
  description: string;
  operation: string;
  parameters: (read: DiscoverSignalRead) => Record<string, unknown>;
  digest: (result: unknown) => string[];
  items?: (result: unknown) => DiscoverResearchResult[];
  needsLocation?: boolean;
}

export const DISCOVER_SIGNAL_LINE_LIMIT = 12;

export const DISCOVER_SIGNAL_GROUPS: Record<
  DiscoverSignalGroup,
  { label: string; oneOf: boolean }
> = {
  listening: { label: "Listening", oneOf: false },
  reading: { label: "Reading", oneOf: false },
  watching: { label: "Watching", oneOf: false },
  fitness: { label: "Fitness", oneOf: true },
  calendar: { label: "Calendar", oneOf: true },
  mail: { label: "Mail", oneOf: true },
  tasks: { label: "Tasks", oneOf: true },
  work: { label: "Work", oneOf: false },
  places: { label: "Places", oneOf: true },
  pictures: { label: "Pictures", oneOf: false },
  models: { label: "Models", oneOf: false },
  social: { label: "Social", oneOf: false },
  playing: { label: "Playing", oneOf: false },
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function first(value: unknown, ...paths: readonly (readonly (string | number)[])[]): string {
  for (const path of paths) {
    const found = readPathValues(value, path).find((item) => text(item));

    if (found !== undefined) {
      return text(found);
    }
  }

  return "";
}

function items(result: unknown, ...paths: readonly (readonly (string | number)[])[]): unknown[] {
  for (const path of paths) {
    const [found] = readPathValues(result, path);

    if (Array.isArray(found)) {
      return found;
    }
  }

  return Array.isArray(result) ? result : [];
}

function lines(
  entries: unknown[],
  render: (entry: Record<string, unknown>) => string,
  limit = DISCOVER_SIGNAL_LINE_LIMIT,
): string[] {
  const seen = new Set<string>();
  const rendered: string[] = [];

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }

    const line = render(entry).replace(/\s+/g, " ").trim();

    if (!line || seen.has(line)) {
      continue;
    }

    seen.add(line);
    rendered.push(line);

    if (rendered.length >= limit) {
      break;
    }
  }

  return rendered;
}

function joinParts(...parts: readonly string[]): string {
  return parts.filter(Boolean).join(" · ");
}

export const DISCOVER_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "lastfm-recent",
    providerId: "lastfm",
    group: "listening",
    title: "Last.fm",
    description: "Reads what you have been listening to.",
    operation: "get_recent_tracks",
    parameters: () => ({ limit: 30 }),
    digest: (result) =>
      lines(items(result, ["recenttracks", "track"]), (track) =>
        joinParts(first(track, ["artist", "#text"], ["artist", "name"]), first(track, ["name"])),
      ),
  },
  {
    id: "lastfm-top-artists",
    providerId: "lastfm",
    group: "listening",
    title: "Last.fm top artists",
    description: "Reads the artists you have played most this month.",
    operation: "get_top_artists",
    parameters: () => ({ period: "1month", limit: 10 }),
    digest: (result) =>
      lines(items(result, ["topartists", "artist"]), (artist) =>
        joinParts(
          first(artist, ["name"]),
          first(artist, ["playcount"]) && `${first(artist, ["playcount"])} plays`,
        ),
      ),
  },
  {
    id: "audiobookshelf-progress",
    providerId: "audiobookshelf",
    group: "listening",
    title: "Audiobookshelf",
    description: "Reads the audiobooks and podcasts you're part way through.",
    operation: "list_in_progress",
    parameters: () => ({}),
    digest: (result) =>
      lines(items(result, ["libraryItems"], ["items"], ["results"]), (item) =>
        joinParts(
          first(item, ["media", "metadata", "title"], ["title"]),
          first(item, ["media", "metadata", "authorName"], ["author"]),
        ),
      ),
  },
  {
    id: "readwise-highlights",
    providerId: "readwise",
    group: "reading",
    title: "Readwise",
    description: "Reads your recent highlights and Reader queue.",
    operation: "list_highlights",
    parameters: ({ now }) => ({ updatedAfter: isoDaysBefore(now, 7) }),
    digest: (result) =>
      lines(items(result, ["results"]), (book) =>
        joinParts(
          first(book, ["title"]),
          first(book, ["author"]),
          first(book, ["highlights", 0, "text"]).slice(0, 140),
        ),
      ),
  },
  {
    id: "readwise-reader",
    providerId: "readwise",
    group: "reading",
    title: "Readwise Reader",
    description: "Reads what is waiting in your Reader queue.",
    operation: "list_reader_documents",
    parameters: ({ now }) => ({ location: "later", updatedAfter: isoDaysBefore(now, 14) }),
    digest: (result) =>
      lines(items(result, ["results"]), (document) =>
        joinParts(first(document, ["title"]), first(document, ["site_name"], ["author"])),
      ),
  },
  {
    id: "hardcover-reading",
    providerId: "hardcover",
    group: "reading",
    title: "Hardcover",
    description: "Reads the books you are reading.",
    operation: "list_books",
    parameters: () => ({ status: "currently_reading", limit: 20 }),
    digest: (result) =>
      lines(items(result, ["data", "me", 0, "user_books"], ["books"], ["results"]), (book) =>
        joinParts(
          first(book, ["book", "title"], ["title"]),
          first(book, ["book", "contributions", 0, "author", "name"], ["author"]),
        ),
      ),
  },
  {
    id: "raindrop-bookmarks",
    providerId: "raindrop",
    group: "reading",
    title: "Raindrop.io",
    description: "Reads the bookmarks you keep adding.",
    operation: "RAINDROP_LIST_BOOKMARKS",
    parameters: () => ({ collection_id: 0, sort: "-created", per_page: 25 }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"]), (bookmark) =>
        joinParts(
          first(bookmark, ["title"]),
          first(bookmark, ["domain"]),
          first(bookmark, ["link"]),
        ),
      ),
  },
  {
    id: "devto-reading-list",
    providerId: "devto",
    group: "reading",
    title: "DEV Community",
    description: "Reads your DEV reading list.",
    operation: "DEVTO_LIST_READING_LIST",
    parameters: () => ({ per_page: 20 }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["data"], ["items"]), (item) =>
        joinParts(
          first(item, ["article", "title"], ["title"]),
          first(item, ["article", "user", "name"]),
          first(item, ["article", "url"], ["url"]),
        ),
      ),
  },
  {
    id: "trakt-history",
    providerId: "trakt",
    group: "watching",
    title: "Trakt",
    description: "Reads the films and shows you have watched.",
    operation: "get_history",
    parameters: () => ({ type: "shows", limit: 20 }),
    digest: (result) =>
      lines(items(result, ["data"], []), (entry) =>
        joinParts(
          first(entry, ["show", "title"], ["movie", "title"]),
          first(entry, ["episode", "title"]),
          first(entry, ["watched_at"]).slice(0, 10),
        ),
      ),
  },
  {
    id: "marquee-shelf",
    providerId: "marquee",
    group: "watching",
    title: "Marquee shelf",
    description: "Reads what you are watching and want to watch on Marquee.",
    operation: "get_shelf",
    parameters: () => ({}),
    digest: (result) =>
      lines(
        items(result, ["entries"]).filter(
          (entry) => isRecord(entry) && entry.status !== "watched" && entry.status !== "dropped",
        ),
        (entry) =>
          joinParts(
            first(entry, ["title"]),
            first(entry, ["year"]),
            first(entry, ["status"]),
            first(entry, ["thoughts"]).slice(0, 100),
          ),
      ),
  },
  {
    id: "marquee-week",
    providerId: "marquee",
    group: "watching",
    title: "Marquee week ahead",
    description: "Reads the episodes and releases coming this week on your Marquee shelf.",
    operation: "whats_on_this_week",
    parameters: () => ({ days: 7 }),
    digest: (result) =>
      lines(items(result, ["entries"]), (entry) =>
        joinParts(
          first(entry, ["when"]).slice(0, 16).replace("T", " "),
          first(entry, ["title"]),
          first(entry, ["season"]) && `S${first(entry, ["season"])}E${first(entry, ["episode"])}`,
          first(entry, ["name"]),
          first(entry, ["network"]),
        ),
      ),
  },
  {
    id: "youtube-subscriptions",
    providerId: "youtube",
    group: "watching",
    title: "YouTube",
    description: "Reads the channels you subscribe to.",
    operation: "YOUTUBE_LIST_USER_SUBSCRIPTIONS",
    parameters: () => ({ part: "snippet", maxResults: 30 }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"]), (subscription) =>
        joinParts(
          first(subscription, ["snippet", "title"]),
          first(subscription, ["snippet", "description"]).slice(0, 80),
        ),
      ),
  },
  {
    id: "youtube-liked",
    providerId: "youtube",
    group: "watching",
    title: "YouTube likes",
    description: "Reads the videos you liked most recently.",
    operation: "YOUTUBE_LIST_RATED_VIDEOS",
    parameters: () => ({ part: "snippet", rating: "like", max_results: 15 }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"]), (video) =>
        joinParts(
          first(video, ["snippet", "title"]),
          first(video, ["snippet", "channelTitle"]),
          first(video, ["snippet", "publishedAt"]).slice(0, 10),
        ),
      ),
  },
  {
    id: "oura-readiness",
    providerId: "oura",
    group: "fitness",
    title: "Oura",
    description: "Reads readiness and sleep for the brief only, never as an interest.",
    operation: "get_daily_readiness",
    parameters: ({ date }) => ({ startDate: shiftCalendarDate(date, -1), endDate: date }),
    digest: (result) =>
      lines(items(result, ["data"]), (day) =>
        joinParts(
          first(day, ["day"]),
          first(day, ["score"]) && `readiness ${first(day, ["score"])}`,
        ),
      ),
  },
  {
    id: "googlecalendar-today",
    providerId: "googlecalendar",
    group: "calendar",
    title: "Google Calendar",
    description: "Reads today's and tomorrow's events.",
    operation: "GOOGLECALENDAR_EVENTS_LIST",
    parameters: ({ now, timezone }) => ({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 20,
      timeZone: timezone,
    }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"], ["data", "events"]), (event) =>
        joinParts(
          first(event, ["start", "dateTime"], ["start", "date"]).slice(0, 16).replace("T", " "),
          first(event, ["summary"]),
          first(event, ["location"]).slice(0, 60),
        ),
      ),
  },
  {
    id: "outlook-calendar",
    providerId: "outlook",
    group: "calendar",
    title: "Outlook Calendar",
    description: "Reads today's and tomorrow's events.",
    operation: "OUTLOOK_GET_CALENDAR_VIEW",
    parameters: ({ now, timezone }) => ({
      user_id: "me",
      start_datetime: now.toISOString(),
      end_datetime: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      top: 20,
      timezone,
    }),
    digest: (result) =>
      lines(items(result, ["data", "value"], ["value"], ["data", "events"]), (event) =>
        joinParts(
          first(event, ["start", "dateTime"]).slice(0, 16).replace("T", " "),
          first(event, ["subject"]),
          first(event, ["location", "displayName"]).slice(0, 60),
        ),
      ),
  },
  {
    id: "gmail-newsletters",
    providerId: "gmail",
    group: "mail",
    title: "Gmail newsletters",
    description: "Reads the newsletters that arrived in the last day, never your personal mail.",
    operation: "GMAIL_FETCH_EMAILS",
    parameters: () => ({
      user_id: "me",
      query: "newer_than:1d list:* -category:personal -category:social",
      max_results: 15,
      include_payload: false,
      verbose: true,
    }),
    digest: (result) =>
      lines(items(result, ["data", "messages"], ["messages"]), (message) =>
        joinParts(
          first(message, ["sender"], ["from"]).slice(0, 60),
          first(message, ["subject"]),
          htmlToPlainText(first(message, ["messageText"], ["preview", "body"], ["snippet"])).slice(
            0,
            700,
          ),
        ),
      ),
  },
  {
    id: "outlook-newsletters",
    providerId: "outlook",
    group: "mail",
    title: "Outlook newsletters",
    description: "Reads the newsletters that arrived in the last day, never your personal mail.",
    operation: "OUTLOOK_SEARCH_MESSAGES",
    parameters: ({ now }) => ({
      user_id: "me",
      query: `unsubscribe received>=${isoDaysBefore(now, 1).slice(0, 10)}`,
      size: 15,
    }),
    digest: (result) =>
      lines(items(result, ["data", "messages"], ["data", "value"], ["value"]), (message) =>
        joinParts(
          first(message, ["from", "emailAddress", "name"], ["from"]).slice(0, 60),
          first(message, ["subject"]),
          first(message, ["bodyPreview"]).slice(0, 140),
        ),
      ),
  },
  {
    id: "googletasks-due",
    providerId: "googletasks",
    group: "tasks",
    title: "Google Tasks",
    description: "Reads the tasks due in the next two days.",
    operation: "GOOGLETASKS_LIST_TASKS",
    parameters: ({ now }) => ({
      tasklist_id: "@default",
      dueMax: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      showCompleted: false,
      maxResults: 20,
    }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"]), (task) =>
        joinParts(first(task, ["due"]).slice(0, 10), first(task, ["title"])),
      ),
  },
  {
    id: "todoist-due",
    providerId: "todoist",
    group: "tasks",
    title: "Todoist",
    description: "Reads the tasks due today and overdue.",
    operation: "TODOIST_GET_ALL_TASKS",
    parameters: () => ({ filter: "today | overdue", limit: 20 }),
    digest: (result) =>
      lines(items(result, ["data", "results"], ["data", "items"], ["results"], ["items"]), (task) =>
        joinParts(first(task, ["due", "date"]).slice(0, 10), first(task, ["content"])),
      ),
  },
  {
    id: "ticktick-due",
    providerId: "ticktick",
    group: "tasks",
    title: "TickTick",
    description: "Reads your open tasks.",
    operation: "TICKTICK_LIST_ALL_TASKS",
    parameters: () => ({ limit: 20 }),
    digest: (result) =>
      lines(items(result, ["data", "tasks"], ["data", "items"], ["tasks"], ["items"]), (task) =>
        joinParts(first(task, ["dueDate"]).slice(0, 10), first(task, ["title"])),
      ),
  },
  {
    id: "linear-assigned",
    providerId: "linear",
    group: "work",
    title: "Linear",
    description: "Reads the unfinished issues assigned to you.",
    operation: "LINEAR_LIST_LINEAR_ISSUES",
    parameters: () => ({ assignee_id: "me", first: 20 }),
    digest: (result) =>
      lines(items(result, ["data", "issues"], ["issues"], ["data", "nodes"]), (issue) =>
        joinParts(
          first(issue, ["identifier"]),
          first(issue, ["title"]),
          first(issue, ["state", "name"], ["state"]),
          first(issue, ["dueDate"]).slice(0, 10),
        ),
      ),
  },
  {
    id: "github-notifications",
    providerId: "github",
    group: "work",
    title: "GitHub",
    description: "Reads the notifications waiting for you.",
    operation: "GITHUB_LIST_NOTIFICATIONS",
    parameters: ({ now }) => ({ since: isoDaysBefore(now, 2), per_page: 20, participating: true }),
    digest: (result) =>
      lines(items(result, ["data", "details"], ["data", "items"], ["data"]), (notification) =>
        joinParts(
          first(notification, ["repository", "full_name"]),
          first(notification, ["subject", "type"]),
          first(notification, ["subject", "title"]),
        ),
      ),
  },
  {
    id: "fathom-meetings",
    providerId: "fathom",
    group: "work",
    title: "Fathom",
    description: "Reads yesterday's meeting summaries and action items.",
    operation: "FATHOM_LIST_MEETINGS",
    parameters: ({ now }) => ({ created_after: isoDaysBefore(now, 2), include_action_items: true }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"], ["data", "meetings"]), (meeting) =>
        joinParts(
          first(meeting, ["created_at"], ["recording_start_time"]).slice(0, 10),
          first(meeting, ["title"], ["meeting_title"]),
          first(meeting, ["action_items", 0, "description"]).slice(0, 120),
        ),
      ),
  },
  {
    id: "wakatime-week",
    providerId: "wakatime",
    group: "work",
    title: "WakaTime",
    description: "Reads how your coding week has gone.",
    operation: "WAKATIME_GET_USER_SUMMARIES",
    parameters: () => ({ user: "current", range: "last_7_days" }),
    digest: (result) =>
      lines(items(result, ["data", "data"], ["data"]), (day) =>
        joinParts(
          first(day, ["range", "date"]),
          first(day, ["grand_total", "text"]),
          first(day, ["projects", 0, "name"]),
        ),
      ),
  },
  {
    id: "openweather-today",
    providerId: "openweather_api",
    group: "places",
    title: "OpenWeather",
    description: "Reads today's weather where you are.",
    operation: "OPENWEATHER_API_GET_CURRENT_WEATHER",
    needsLocation: true,
    parameters: ({ location }) => ({ q: location ?? "", units: "metric" }),
    digest: (result) =>
      lines([isRecord(result) && isRecord(result.data) ? result.data : result], (weather) =>
        joinParts(
          first(weather, ["name"]),
          first(weather, ["weather", 0, "description"]),
          first(weather, ["main", "temp"]) && `${first(weather, ["main", "temp"])}°C`,
        ),
      ),
  },
  {
    id: "googlephotos-on-this-day",
    providerId: "googlephotos",
    group: "pictures",
    title: "Google Photos",
    description: "Finds photos you took on this day in earlier years.",
    operation: "GOOGLEPHOTOS_SEARCH_MEDIA_ITEMS",
    parameters: ({ date }) => {
      const [, month, day] = date.split("-").map(Number);

      return {
        pageSize: 10,
        filters: { dateFilter: { dates: [{ month, day }] } },
      };
    },
    digest: (result) =>
      lines(items(result, ["data", "mediaItems"], ["mediaItems"]), (item) =>
        joinParts(
          first(item, ["mediaMetadata", "creationTime"]).slice(0, 10),
          first(item, ["filename"]),
          first(item, ["productUrl"]),
        ),
      ),
  },
  {
    id: "reddit-front",
    providerId: "reddit",
    group: "social",
    title: "Reddit",
    description: "Reads the best posts from the communities you subscribe to.",
    operation: "REDDIT_GET",
    parameters: () => ({ sort: "best", limit: 25 }),
    items: (result) =>
      items(result, ["data", "data", "children"], ["data", "children"], ["children"]).flatMap(
        (child) => {
          const post = isRecord(child) && isRecord(child.data) ? child.data : child;

          if (!isRecord(post) || post.over_18 === true || post.stickied === true) {
            return [];
          }

          const title = first(post, ["title"]);
          const permalink = first(post, ["permalink"]);
          const subreddit = first(post, ["subreddit_name_prefixed"], ["subreddit"]);
          const score = first(post, ["score"]);

          if (!title || !permalink) {
            return [];
          }

          return [
            {
              title,
              url: `https://www.reddit.com${permalink.startsWith("/") ? "" : "/"}${permalink}`,
              snippet: first(post, ["selftext"]).slice(0, 1_200),
              source: [
                subreddit.startsWith("r/") || !subreddit ? subreddit : `r/${subreddit}`,
                score ? `${score} points` : "",
              ]
                .filter(Boolean)
                .join(", "),
              date: epochSecondsToIso(post.created_utc)?.slice(0, 10) ?? "",
            },
          ];
        },
      ),
    digest: (result) =>
      lines(
        items(result, ["data", "data", "children"], ["data", "children"], ["children"]),
        (post) =>
          joinParts(
            first(post, ["data", "title"], ["title"]),
            first(post, ["data", "subreddit_name_prefixed"], ["data", "subreddit"], ["subreddit"]),
            first(post, ["data", "permalink"], ["permalink"]).replace(
              /^\//u,
              "https://www.reddit.com/",
            ),
          ),
      ),
  },
  {
    id: "nasa-apod",
    providerId: "nasa",
    group: "pictures",
    title: "NASA",
    description: "Reads today's astronomy picture of the day.",
    operation: "NASA_GET_APOD",
    parameters: () => ({ hd: false }),
    digest: (result) =>
      lines([isRecord(result) && isRecord(result.data) ? result.data : result], (picture) =>
        joinParts(
          first(picture, ["title"]),
          first(picture, ["url"]),
          first(picture, ["explanation"]).slice(0, 160),
        ),
      ),
  },
  {
    id: "artificial-analysis-models",
    providerId: "artificial_analysis",
    group: "models",
    title: "Artificial Analysis",
    description: "Reads the current language model index.",
    operation: "ARTIFICIAL_ANALYSIS_LIST_LANGUAGE_MODELS",
    parameters: () => ({}),
    digest: (result) =>
      lines(
        items(result, ["data", "data"], ["data"]),
        (model) =>
          joinParts(
            first(model, ["name"]),
            first(model, ["model_creator", "name"]),
            first(model, ["evaluations", "artificial_analysis_intelligence_index"]) &&
              `index ${first(model, ["evaluations", "artificial_analysis_intelligence_index"])}`,
          ),
        8,
      ),
  },
];

export function findDiscoverSignal(id: string): DiscoverSignal | undefined {
  return DISCOVER_SIGNALS.find((signal) => signal.id === id);
}
