import { configuredComposioToolkits } from "~/lib/providers/capabilities/connectors/composio/configured-toolkit-manifest";

import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, preferredConnectorsField, reviewInstructionsField } from "./shared";

function allToolkitOperations(provider: keyof typeof configuredComposioToolkits): string[] {
  return configuredComposioToolkits[provider].operations.map((operation) => operation.id);
}

export const workspaceRecipes: CatalogRecipe[] = [
  {
    id: "notes-assistant",
    title: "Notes Assistant",
    summary: "Search your notes and capture reviewed pages, decisions, and follow-ups.",
    description:
      "Uses whichever of Notion, Google Docs, and Confluence is connected to find existing content and create or append reviewed notes, action logs, and recaps from chat.",
    kind: "integrate",
    category: "Productivity",
    featured: true,
    enabledTools: [RECIPE_CONNECTOR_TOOL],
    integrations: [
      {
        id: "notion",
        providerId: "notion",
        name: "Notion",
        description: "Searches pages and creates or appends reviewed Notion content.",
        requiresConnection: true,
        connectionGroup: "notes",
        operationIds: [
          "NOTION_SEARCH_NOTION_PAGE",
          "NOTION_RETRIEVE_PAGE",
          "NOTION_CREATE_NOTION_PAGE",
          "NOTION_ADD_MULTIPLE_PAGE_CONTENT",
        ],
      },
      {
        id: "googledocs",
        providerId: "googledocs",
        name: "Google Docs",
        description: "Finds documents and creates or updates reviewed Google Docs content.",
        requiresConnection: true,
        connectionGroup: "notes",
        operationIds: allToolkitOperations("googledocs"),
      },
      {
        id: "confluence",
        providerId: "confluence",
        name: "Confluence",
        description: "Finds pages and creates or updates reviewed Confluence content.",
        requiresConnection: true,
        connectionGroup: "notes",
        operationIds: allToolkitOperations("confluence"),
      },
    ],
    triggers: [
      {
        type: "message",
        label: "Ask about your notes",
        description: "Ask Polychat to search notes or capture a decision, action item, or recap.",
      },
    ],
    actions: [
      "Search pages and documents in the connected notes service",
      "Create reviewed pages and documents",
      "Append approved decisions, action items, and recaps to a chosen target",
    ],
    setupPrompt:
      "Set up the Notes Assistant recipe. Use the connected notes service, ask which workspace area, page, database, or document to use as the default target, and create or append content only after I confirm the exact target and content. Do not delete or restructure existing content.",
    configurationFields: [
      preferredConnectorsField,
      {
        key: "notesTarget",
        label: "Default target",
        type: "text",
        placeholder: "Page, database, document, or space",
      },
      {
        key: "entryFormat",
        label: "Entry format",
        type: "textarea",
        placeholder: "Templates for decisions, action items, owners, due dates, and recaps",
      },
      reviewInstructionsField,
    ],
  },
  {
    id: "meeting-prep",
    title: "Meeting Prep",
    summary: "Get a briefing for upcoming meetings from your calendar, mail, and notes.",
    description:
      "Reads upcoming events from a connected calendar and enriches each meeting with related emails and Notion notes when those services are connected.",
    kind: "automate",
    category: "Productivity",
    featured: true,
    enabledTools: [RECIPE_CONNECTOR_TOOL],
    integrations: [
      {
        id: "googlecalendar",
        providerId: "googlecalendar",
        name: "Google Calendar",
        description: "Reads upcoming meetings and attendees.",
        requiresConnection: true,
        connectionGroup: "calendar",
        operationIds: ["GOOGLECALENDAR_EVENTS_LIST"],
      },
      {
        id: "outlook-calendar",
        providerId: "outlook",
        name: "Outlook Calendar",
        description: "Reads upcoming Outlook meetings and attendees.",
        requiresConnection: true,
        connectionGroup: "calendar",
        operationIds: ["OUTLOOK_GET_CALENDAR_VIEW"],
      },
      {
        id: "gmail",
        providerId: "gmail",
        name: "Gmail",
        description: "Finds recent messages from meeting attendees when connected.",
        requiresConnection: false,
        operationIds: ["GMAIL_FETCH_EMAILS"],
      },
      {
        id: "outlook-mail",
        providerId: "outlook",
        name: "Outlook Mail",
        description: "Finds recent messages from meeting attendees when connected.",
        requiresConnection: false,
        operationIds: ["OUTLOOK_SEARCH_MESSAGES"],
      },
      {
        id: "notion",
        providerId: "notion",
        name: "Notion",
        description: "Finds related meeting notes and project pages when connected.",
        requiresConnection: false,
        operationIds: ["NOTION_SEARCH_NOTION_PAGE", "NOTION_RETRIEVE_PAGE"],
      },
    ],
    triggers: [
      {
        type: "message",
        label: "Ask for meeting prep",
        description: "Ask Polychat to prepare you for your next meeting or a named meeting.",
      },
      {
        type: "schedule",
        label: "Daily prep",
        description: "Run a recurring briefing before the day's meetings.",
      },
    ],
    actions: [
      "Read upcoming meetings, attendees, and agendas from the connected calendar",
      "Search connected mail and Notion for context on each meeting",
      "Summarise what each meeting needs from you with open questions and links",
    ],
    setupPrompt:
      "Set up the Meeting Prep recipe. Read upcoming meetings from the connected calendar, then use connected mail and Notion to gather context on attendees and topics; never block on services that are not connected. Summarise each meeting's purpose, open threads, and suggested preparation. Do not send messages, respond to invitations, or change events.",
    configurationFields: [
      preferredConnectorsField,
      {
        key: "prepWindow",
        label: "Prep window",
        type: "text",
        placeholder: "Today, next 24 hours, tomorrow morning",
      },
      {
        key: "meetingFocus",
        label: "Meeting focus",
        type: "textarea",
        placeholder: "Meetings, projects, or attendees that matter most, and any to skip",
      },
      reviewInstructionsField,
    ],
  },
  {
    id: "task-capture",
    title: "Task Capture",
    summary: "Turn chat, notes, and emails into tasks in your connected task manager.",
    description:
      "Captures action items from conversations and connected mail into whichever task service is connected, Todoist, TickTick, Asana, or Linear, after review.",
    kind: "automate",
    category: "To-dos",
    featured: true,
    enabledTools: [RECIPE_CONNECTOR_TOOL],
    integrations: [
      {
        id: "todoist",
        providerId: "todoist",
        name: "Todoist",
        description: "Lists tasks and creates reviewed Todoist tasks.",
        requiresConnection: true,
        connectionGroup: "tasks",
        operationIds: ["TODOIST_GET_ALL_TASKS", "TODOIST_CREATE_TASK"],
      },
      {
        id: "ticktick",
        providerId: "ticktick",
        name: "TickTick",
        description: "Lists projects and creates reviewed TickTick tasks.",
        requiresConnection: true,
        connectionGroup: "tasks",
        operationIds: ["TICKTICK_GET_USER_PROJECT", "TICKTICK_CREATE_TASK"],
      },
      {
        id: "asana",
        providerId: "asana",
        name: "Asana",
        description: "Lists projects and creates reviewed Asana tasks.",
        requiresConnection: true,
        connectionGroup: "tasks",
        operationIds: ["ASANA_GET_MULTIPLE_PROJECTS", "ASANA_CREATE_A_TASK"],
      },
      {
        id: "linear",
        providerId: "linear",
        name: "Linear",
        description: "Searches issues and creates reviewed Linear issues.",
        requiresConnection: true,
        connectionGroup: "tasks",
        operationIds: ["LINEAR_SEARCH_ISSUES", "LINEAR_CREATE_LINEAR_ISSUE"],
      },
      {
        id: "gmail",
        providerId: "gmail",
        name: "Gmail",
        description: "Finds actionable emails to capture as tasks when connected.",
        requiresConnection: false,
        operationIds: ["GMAIL_FETCH_EMAILS"],
      },
      {
        id: "outlook",
        providerId: "outlook",
        name: "Outlook",
        description: "Finds actionable emails to capture as tasks when connected.",
        requiresConnection: false,
        operationIds: ["OUTLOOK_SEARCH_MESSAGES"],
      },
    ],
    triggers: [
      {
        type: "message",
        label: "Capture a task",
        description: "Ask Polychat to turn a message, email, or idea into a task.",
      },
    ],
    actions: [
      "Extract action items from chat or connected mail",
      "Propose the task title, notes, due date, and destination",
      "Create tasks only after confirming each one",
    ],
    setupPrompt:
      "Set up the Task Capture recipe. Use the connected task service as the destination, extract clear action items from what I share or from connected mail, and propose each task with title, notes, due date, and destination before creating it. Create tasks only after I approve them, and do not complete, update, or delete existing tasks in this recipe.",
    configurationFields: [
      preferredConnectorsField,
      {
        key: "defaultDestination",
        label: "Default project or team",
        type: "text",
        placeholder: "Inbox, Work, Platform team",
      },
      {
        key: "taskRules",
        label: "Task rules",
        type: "textarea",
        placeholder: "Labels, priorities, due-date wording, or capture boundaries",
      },
      reviewInstructionsField,
    ],
  },
  {
    id: "task-manager",
    title: "Task Manager",
    summary: "Review, create, and complete tasks in your connected task manager.",
    description:
      "Uses whichever of Todoist, TickTick, and Asana is connected to review tasks and projects and apply confirmed task changes from chat.",
    kind: "integrate",
    category: "To-dos",
    featured: true,
    enabledTools: [RECIPE_CONNECTOR_TOOL],
    integrations: [
      {
        id: "todoist",
        providerId: "todoist",
        name: "Todoist",
        description: "Lists, creates, and completes Todoist tasks.",
        requiresConnection: true,
        connectionGroup: "tasks",
        operationIds: ["TODOIST_GET_ALL_TASKS", "TODOIST_CREATE_TASK", "TODOIST_CLOSE_TASK_V1"],
      },
      {
        id: "ticktick",
        providerId: "ticktick",
        name: "TickTick",
        description: "Reads and manages TickTick projects and tasks through their full lifecycle.",
        requiresConnection: true,
        connectionGroup: "tasks",
        operationIds: [
          "TICKTICK_GET_USER_PROJECT",
          "TICKTICK_GET_PROJECT_BY_ID",
          "TICKTICK_GET_PROJECT_WITH_DATA",
          "TICKTICK_LIST_ALL_TASKS",
          "TICKTICK_GET_TASK_BY_PROJECT_AND_ID",
          "TICKTICK_CREATE_PROJECT",
          "TICKTICK_UPDATE_PROJECT",
          "TICKTICK_DELETE_PROJECT",
          "TICKTICK_CREATE_TASK",
          "TICKTICK_UPDATE_TASK",
          "TICKTICK_COMPLETE_TASK",
          "TICKTICK_DELETE_TASK",
        ],
      },
      {
        id: "asana",
        providerId: "asana",
        name: "Asana",
        description: "Lists projects and tasks and creates reviewed Asana tasks.",
        requiresConnection: true,
        connectionGroup: "tasks",
        operationIds: [
          "ASANA_GET_MULTIPLE_PROJECTS",
          "ASANA_GET_MULTIPLE_TASKS",
          "ASANA_CREATE_A_TASK",
        ],
      },
    ],
    triggers: [
      {
        type: "message",
        label: "Ask about your tasks",
        description: "Ask Polychat to review, create, or complete tasks.",
      },
    ],
    actions: [
      "List tasks and projects from the connected task service",
      "Create reviewed tasks with due dates, labels, and destinations",
      "Complete, update, or delete tasks only where the service supports it and after confirmation",
    ],
    setupPrompt:
      "Set up the Task Manager recipe. Use the connected task service, ask which projects, labels, or views I care about, and propose every change before applying it. Capabilities differ by service: use only the operations discovery reports for the chosen service, and require explicit confirmation before completing, updating, or deleting anything.",
    configurationFields: [
      preferredConnectorsField,
      {
        key: "defaultProject",
        label: "Default project",
        type: "text",
        placeholder: "Inbox, Work, Personal, or a project ID",
      },
      {
        key: "taskDefaults",
        label: "Task defaults",
        type: "textarea",
        placeholder: "Priority, labels, due dates, reminders, and confirmation rules",
      },
      reviewInstructionsField,
    ],
  },
];
