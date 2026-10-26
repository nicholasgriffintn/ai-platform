import type { KnowledgeConnectorDescriptor } from "@ngriffin_uk/polychat-schemas";

export const KNOWLEDGE_CONNECTOR_DESCRIPTORS: readonly KnowledgeConnectorDescriptor[] = [
  {
    id: "notion-database",
    provider: "notion",
    title: "Notion database",
    description: "Every page in a Notion database, one document per page, read as Markdown.",
    parameters: [{ name: "database_id", label: "Database ID", required: true }],
    list: {
      operation: "NOTION_QUERY_DATABASE",
      parameters: { database_id: "{{database_id}}", page_size: 50 },
      items: ["data", "results"],
      pagination: {
        kind: "cursor",
        request: "start_cursor",
        response: ["data", "next_cursor"],
        hasMore: ["data", "has_more"],
      },
    },
    item: {
      id: ["id"],
      title: ["properties", "*", "title", "*", "plain_text"],
      url: ["url"],
      revision: ["last_edited_time"],
      updatedAt: ["last_edited_time"],
      archived: { path: ["archived"], values: [true] },
    },
    read: {
      operation: "NOTION_GET_PAGE_MARKDOWN",
      idParameter: "page_id",
      parameters: {},
      content: { path: ["data", "markdown"], format: "text" },
    },
  },
  {
    id: "google-drive-docs",
    provider: "googledrive",
    title: "Google Docs in Drive",
    description:
      "Google Docs from your Drive, or from one folder, one document per file, exported as plain text.",
    parameters: [{ name: "folder_id", label: "Folder ID", required: false }],
    list: {
      operation: "GOOGLEDRIVE_FIND_FILE",
      parameters: {
        folder_id: "{{folder_id}}",
        q: "mimeType = 'application/vnd.google-apps.document' and trashed = false",
        pageSize: 50,
      },
      items: ["data", "files"],
      pagination: { kind: "cursor", request: "pageToken", response: ["data", "nextPageToken"] },
    },
    item: {
      id: ["id"],
      title: ["name"],
      url: ["webViewLink"],
      revision: ["version"],
      updatedAt: ["modifiedTime"],
      archived: { path: ["trashed"], values: [true] },
    },
    read: {
      operation: "GOOGLEDRIVE_EXPORT_GOOGLE_WORKSPACE_FILE",
      idParameter: "fileId",
      parameters: { mimeType: "text/plain" },
      content: { path: ["data", "file", "s3url"], format: "url" },
    },
  },
  {
    id: "gmail-search",
    provider: "gmail",
    title: "Gmail search",
    description:
      "Emails that match a Gmail search, such as label:receipts, one document per email.",
    parameters: [
      {
        name: "query",
        label: "Gmail search",
        description: "Uses Gmail's own search syntax, such as label:receipts newer_than:30d.",
        required: true,
      },
    ],
    list: {
      operation: "GMAIL_FETCH_EMAILS",
      parameters: { query: "{{query}}", max_results: 25 },
      items: ["data", "messages"],
      pagination: { kind: "cursor", request: "page_token", response: ["data", "nextPageToken"] },
    },
    item: {
      id: ["messageId"],
      title: ["subject"],
      url: ["display_url"],
      updatedAt: ["messageTimestamp"],
      content: { path: ["messageText"], format: "text" },
    },
  },
  {
    id: "slack-channel",
    provider: "slack",
    title: "Slack channel",
    description: "Messages posted in a Slack channel, one document per message.",
    parameters: [{ name: "channel", label: "Channel ID", required: true }],
    list: {
      operation: "SLACK_FETCH_CONVERSATION_HISTORY",
      parameters: { channel: "{{channel}}", limit: 100 },
      items: ["data", "messages"],
      pagination: {
        kind: "cursor",
        request: "cursor",
        response: ["data", "response_metadata", "next_cursor"],
        hasMore: ["data", "has_more"],
      },
      updatedSince: { request: "oldest", format: "epoch_seconds" },
    },
    item: {
      id: ["ts"],
      revision: ["edited", "ts"],
      updatedAt: ["ts"],
      content: { path: ["text"], format: "text" },
    },
  },
  {
    id: "github-issues",
    provider: "github",
    title: "GitHub issues",
    description: "Issues and pull requests in a repository, one document per issue.",
    parameters: [
      { name: "owner", label: "Owner", required: true },
      { name: "repo", label: "Repository", required: true },
    ],
    list: {
      operation: "GITHUB_LIST_REPOSITORY_ISSUES",
      parameters: {
        owner: "{{owner}}",
        repo: "{{repo}}",
        state: "all",
        sort: "updated",
        direction: "desc",
        per_page: 50,
      },
      items: ["data", "issues"],
      pagination: { kind: "page", request: "page", start: 1 },
      updatedSince: { request: "since", format: "iso" },
    },
    item: {
      id: ["number"],
      title: ["title"],
      url: ["html_url"],
      revision: ["updated_at"],
      updatedAt: ["updated_at"],
      content: { path: ["body"], format: "text" },
    },
  },
  {
    id: "linear-issues",
    provider: "linear",
    title: "Linear issues",
    description: "Issues in Linear, or in one project, one document per issue.",
    parameters: [{ name: "project_id", label: "Project ID", required: false }],
    list: {
      operation: "LINEAR_LIST_LINEAR_ISSUES",
      parameters: { project_id: "{{project_id}}", first: 50 },
      items: ["data", "issues"],
      pagination: {
        kind: "cursor",
        request: "after",
        response: ["data", "page_info", "endCursor"],
        hasMore: ["data", "page_info", "hasNextPage"],
      },
    },
    item: {
      id: ["id"],
      title: ["title"],
      url: ["url"],
      revision: ["updatedAt"],
      updatedAt: ["updatedAt"],
      content: { path: ["description"], format: "text" },
    },
  },
  {
    id: "jira-search",
    provider: "jira",
    title: "Jira search",
    description: "Jira issues that match a JQL search, one document per issue.",
    parameters: [
      {
        name: "jql",
        label: "JQL",
        description: "Such as project = OPS AND updated >= -30d.",
        required: true,
      },
    ],
    list: {
      operation: "JIRA_SEARCH_FOR_ISSUES_USING_JQL_GET",
      parameters: { jql: "{{jql}}", max_results: 50, fields: "summary,description,updated" },
      items: ["data", "issues"],
      pagination: {
        kind: "cursor",
        request: "next_page_token",
        response: ["data", "nextPageToken"],
      },
    },
    item: {
      id: ["key"],
      title: ["summary"],
      url: ["browser_url"],
      revision: ["updated"],
      updatedAt: ["updated"],
      content: { path: ["description"], format: "text" },
    },
  },
];

export function getKnowledgeConnectorDescriptor(
  id: string,
): KnowledgeConnectorDescriptor | undefined {
  return KNOWLEDGE_CONNECTOR_DESCRIPTORS.find((descriptor) => descriptor.id === id);
}
