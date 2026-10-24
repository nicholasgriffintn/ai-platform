import { LAUNCH_PROJECT_ID } from "../work.mjs";

export const LAUNCH_NOTEBOOK = {
  key: "launch",
  title: "Launch research",
  projectId: LAUNCH_PROJECT_ID,
  created: { days: 10 },
  instructions:
    "Help the launch team decide what to fix before release. Rank issues by how many customers they affect, and always say which source each finding comes from.",
  settings: {
    style: "default",
    persona: "",
    responseLength: "default",
    sourcesOnly: true,
  },
  guide: {
    generated: { days: 1 },
    summary:
      "These sources collect what customers and support have said ahead of the autumn launch. **Customer interviews** show tablet users rely on the Files viewer in landscape, **support tickets** cluster around **PDF previews** failing in older browsers, and a scan of **competitor release notes** suggests rivals already ship offline viewing. Together they point to tablet layout and PDF fallback as the **release blockers**.",
    questions: [
      "Which issue affects the most customers?",
      "What do competitors offer that we don't?",
      "What should we fix before Thursday's release?",
    ],
  },
  sources: [
    {
      key: "interviews",
      kind: "text",
      title: "Customer interviews: tablet users",
      created: { days: 10 },
      content: `# Customer interviews: tablet users

Eight interviews, September.

- Six of eight participants open files mainly on an iPad, usually in landscape on a desk stand.
- Five said the side-by-side chat and file view was the reason they tried the beta.
- Four hit the file panel collapsing when rotating to portrait, and lost their place in long PDFs.
- Two asked for offline access to files they had opened recently, for train journeys.

Quote: "If the file jumps back to page one when I turn the iPad, I give up and open it in another app."`,
    },
    {
      key: "tickets",
      kind: "text",
      title: "Support tickets: PDF previews",
      created: { days: 8 },
      content: `# Support tickets: PDF previews

Tickets tagged files-viewer, last 30 days: 47.

| Theme | Tickets | Notes |
|---|---|---|
| PDF shows blank page | 21 | Mostly Safari 15 and older Chromebooks |
| Slow to open large files | 11 | Files over 40 MB |
| Rotation resets scroll position | 9 | iPad, matches interview findings |
| Download button hidden on mobile | 6 | Fixed in build 412 |

Support's suggested workaround for blank PDFs is a plain download link when the inline preview fails.`,
    },
    {
      key: "competitors",
      kind: "text",
      title: "Competitor release notes, Q3",
      created: { days: 6 },
      content: `# Competitor release notes, Q3

A scan of three competitors' public changelogs.

- **Competitor A** shipped offline viewing for the last 20 opened files on iOS and Android.
- **Competitor B** added a PDF fallback that renders pages as images when the browser cannot preview them.
- **Competitor C** focused on search inside files and has no side-by-side chat.

None of them keep the chat and the file side by side on tablets, which interviewees named as our main draw.`,
    },
  ],
  outputs: [
    {
      key: "brief",
      kind: "report",
      title: "Release blockers brief",
      created: { days: 1 },
      content: {
        format: "markdown",
        body: `# Release blockers brief

## Fix before release
1. **Blank PDF previews** — 21 of 47 tickets. Add a download fallback when the inline preview fails, as Competitor B does.
2. **Rotation resets the file** — 9 tickets and 4 of 8 interviewees. Keep the scroll position when the panel resizes.

## Fix soon after
- **Slow large files** — 11 tickets, files over 40 MB.
- **Offline recent files** — asked for by 2 interviewees and already offered by Competitor A.

## Keep
Side-by-side chat and file on tablets is the main reason people try the beta. Protect it in every layout change.`,
      },
    },
  ],
  chats: [
    {
      key: "blockers",
      title: "What blocks Thursday's release",
      created: { days: 1, hours: 2 },
      messages: [
        { role: "user", content: "What should we fix before Thursday's release?" },
        {
          role: "assistant",
          content:
            "Two things, ranked by how many customers they reach:\n\n1. **Blank PDF previews.** The biggest theme at 21 of 47 tickets, mostly on older Safari and Chromebooks {{cite:tickets}}. A download fallback when the preview fails would cover it, and a competitor already ships something similar {{cite:competitors}}.\n2. **Rotation resetting the file.** Nine tickets {{cite:tickets}}, and half of the interviewees hit it on iPad {{cite:interviews}}.\n\nOffline access and large-file speed matter too, but they affect fewer people and can follow the release {{cite:interviews}} {{cite:tickets}}.",
        },
      ],
    },
  ],
};
