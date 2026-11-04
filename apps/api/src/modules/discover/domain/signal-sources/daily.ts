import { isoDaysBefore, isRecord, shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";
import { htmlToPlainText } from "@ngriffin_uk/polychat-utility-server/html-text";

import { first, items, lines, joinParts, listsNothing } from "./read";
import type { DiscoverSignal } from "./types";

export const DAILY_SIGNALS: readonly DiscoverSignal[] = [
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
    isEmpty: (result) => listsNothing(result, ["data", "items"], ["items"], ["data", "events"]),
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
];
