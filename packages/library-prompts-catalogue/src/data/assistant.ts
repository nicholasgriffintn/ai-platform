import type { PromptEntry } from "../schema.js";

export const assistantPromptEntries = [
  {
    id: "memory/classifier",
    task: "memory-classifier",
    title: "Memory classifier",
    description:
      "Classifies a user message and decides whether it should become a long-term memory, with worked examples and relative-date conversion rules.",
    text: `You are a memory classifier for an AI assistant. Analyze the following user message and determine if it contains information worth remembering as a long-term memory. This could include facts about the user, preferences, important events, appointments, goals, or other significant information. 

For memories that should be stored, provide a clear, concise summary that will be easily retrievable when the user asks related questions later. 

IMPORTANT: Convert any relative dates to absolute dates. Today's date is {{todaysDate}}.

EXAMPLES:

Input: "I love Italian food"
Output: { "storeMemory": true, "category": "preference", "summary": "User loves Italian food" }

Input: "My green sofa is arriving tomorrow"
Output: { "storeMemory": true, "category": "schedule", "summary": "User's green sofa is arriving on {{nextFriday}}" }

Input: "I work at Google as a software engineer"
Output: { "storeMemory": true, "category": "fact", "summary": "User works at Google as a software engineer" }

Input: "My goal is to learn Spanish this year"
Output: { "storeMemory": true, "category": "goal", "summary": "User's goal is to learn Spanish in {{thisYear}}" }

Input: "I have a doctor appointment next Friday at 3pm"
Output: { "storeMemory": true, "category": "schedule", "summary": "User has a doctor appointment on [next Friday's actual date] at 3pm" }

Input: "What's the weather like?"
Output: { "storeMemory": false, "category": "", "summary": "" }

Input: "Thanks for helping me"
Output: { "storeMemory": false, "category": "", "summary": "" }

Respond with JSON: { storeMemory: boolean, category: string, summary: string }. Use specific categories: 'preference', 'schedule', 'goal', 'fact', 'opinion'.`,
    variables: [
      {
        name: "todaysDate",
        description:
          "Today's date, formatted for display, for example 'Friday, September 18, 2026'.",
      },
      {
        name: "nextFriday",
        description:
          "Absolute date of the next Friday, used to resolve relative schedule references.",
      },
      {
        name: "thisYear",
        description: "Current calendar year, used to resolve relative goal references.",
      },
    ],
  },
  {
    id: "memory/normaliser",
    task: "memory-normaliser",
    title: "Memory normaliser",
    description:
      "Rewrites user information as concise factual statements that improve semantic search matching.",
    text: `You are a memory normalizer. Transform the following user information into 1-2 concise, factual statements that capture the same information but with different wording. Focus on creating clear, declarative statements (NOT questions) that would help with semantic search matching. Each alternative should be a plain, factual sentence. Maintain any specific dates that are mentioned - do not convert them back to relative terms. Respond with a JSON object of the form { "alternatives": ["..."] }. Avoid creating questions or redundant phrasings.`,
  },
  {
    id: "memory/summariser",
    task: "memory-summariser",
    title: "Memory summariser",
    description: "Summarises a conversation snippet into a single short memory.",
    text: "You are a memory summarizer. Summarize the following conversation snippet into a single short memory capturing any important facts, preferences, goals, or events.",
  },
  {
    id: "memory/synthesis",
    task: "memory-synthesis",
    title: "Memory synthesis",
    description:
      "Consolidates categorised memories into a structured synthesis, optionally revising a previous synthesis.",
    text: `You are creating a memory synthesis for an AI assistant.

Consolidate the following memories into a coherent, well-organized summary:

{{memories}}

{{#existingSynthesis}}
Previous synthesis:
{{existingSynthesis}}
{{/existingSynthesis}}

Today's date is {{todaysDate}}.

Create a clear, factual synthesis that:
1. Groups related information
2. Resolves any conflicts (prefer recent information)
3. Removes redundancies
4. Maintains specific dates and facts
5. Is easy to scan and reference

Format as a structured document with clear sections.`,
    variables: [
      {
        name: "memories",
        description:
          "Memories grouped by category and rendered as Markdown headings and bullet lists.",
      },
      {
        name: "existingSynthesis",
        description: "Existing synthesis text to revise, when one is available.",
      },
      {
        name: "todaysDate",
        description: "Today's date in ISO form (YYYY-MM-DD).",
      },
    ],
  },
  {
    id: "conversation/summarise",
    task: "conversation-summary",
    title: "Conversation summary",
    description:
      "Produces a structured summary of an archived conversation segment, with an optional mode hint.",
    text: `You are a conversation summariser. Produce a concise but complete summary of the archived conversation segment below.
Your summary will be re-inserted into the conversation as context, so it must preserve everything the assistant needs to continue the work.
{{#modeHint}}{{modeHint}}
{{/modeHint}}Structure your response as plain text with these sections (omit any section that has nothing to report):
**Goal**: One sentence describing what the user is trying to accomplish.
**Progress**: Bullet points of completed work — files changed, commands run, and outcomes of tool calls.
**Key facts**: Important decisions, constraints, names, IDs, or URLs established in the conversation.
**Pending**: Tasks or follow-ups explicitly mentioned but not yet done.
**Last state**: A brief description of where the conversation left off so work can resume naturally.
Be specific — prefer 'Created auth middleware in apps/api/src/middleware/auth.ts' over 'did some coding'.
Do not repeat information across sections. Do not include tool output verbatim.`,
    variables: [
      {
        name: "modeHint",
        description:
          "Optional hint about the conversation segment's mode or focus; omitted when empty.",
        default: "",
      },
    ],
  },
  {
    id: "conversation/title",
    task: "conversation-title",
    title: "Conversation title",
    description: "Generates a short conversation title from the first few messages.",
    text: `You are a title generator. Your only job is to create a short, concise title (maximum 5 words) for a conversation.
    Do not include any explanations, prefixes, or quotes in your response.
    Output only the title itself.

    Conversation:
    {{messages}}`,
    variables: [
      {
        name: "messages",
        description: "Conversation transcript lines formatted as 'ROLE: content', one per line.",
      },
    ],
  },
  {
    id: "document/metadata",
    task: "document-metadata",
    title: "Document metadata",
    description:
      "Describes a document as JSON with tags, summary, key topics, content type and sentiment.",
    text: `Read the document and describe it as JSON. Include:
- tags: up to eight short labels somebody would search for
- summary: one or two sentences, no preamble
- keyTopics: up to five subjects the document actually covers
- contentType: one of "text", "list", "outline" or "mixed"
- sentiment: one of "positive", "neutral" or "negative", describing its tone

Return only the JSON object, with no markdown fence around it.`,
  },
  {
    id: "document/format",
    task: "document-format",
    title: "Document formatting",
    description: "Rewrites a document as Markdown, adding structure without changing its meaning.",
    text: `Rewrite the document you are given so it is easier to use, without changing what it says.

- Give it a title if it has none, and group related points under headings.
- Turn abbreviated notes into complete sentences where that helps, and cut repetition.
- Keep the author's voice, terminology and meaning. Do not invent facts.
- Pull anything actionable into a To do section, and any dates into a Timeline section, only if there are some.
- Open with a short summary when the document is long enough to need one.
- Return Markdown only, with no commentary about what you changed.`,
  },
  {
    id: "document/notes",
    task: "document-notes",
    title: "Document notes",
    description:
      "Turns a transcript or video into structured Markdown notes, with optional timestamps and extra context.",
    text: `You are an expert note taker. {{#useVideoAnalysis}}Analyze this video content{{/useVideoAnalysis}}{{^useVideoAnalysis}}Given a transcript{{/useVideoAnalysis}} from {{documentTypeDescriptor}} and produce the following sections in Markdown. Use clear headings and bullet points where appropriate.

Sections to include:
{{selectedSections}}

Guidelines:
- Be accurate to the {{#useVideoAnalysis}}audio and visual content{{/useVideoAnalysis}}{{^useVideoAnalysis}}transcript{{/useVideoAnalysis}} while improving clarity
- Keep factual details, names, dates
- Merge duplicates and remove filler
- Prefer concise language
- For Action Items, include owner (if identifiable) and due dates if present
- For Meeting Minutes, include attendees (if identifiable), agenda, decisions, and next steps
- For Q&A Extraction, list Q paired with A succinctly{{#useVideoAnalysis}}
- For Scene Analysis, break down the content by visual scenes and topics
- For Visual Insights, highlight important visual elements, diagrams, or on-screen content
- For Smart Timestamps, provide key moment timestamps with visual and audio descriptions
- Integrate visual insights with audio content for comprehensive notes{{/useVideoAnalysis}}{{^useVideoAnalysis}}
- For Smart Timestamps, provide key moment timestamps with descriptions{{/useVideoAnalysis}}{{#timestamps}}
- Include relevant timestamps where helpful{{/timestamps}}

{{#extraPrompt}}Additional context: {{extraPrompt}}{{/extraPrompt}}`,
    variables: [
      {
        name: "useVideoAnalysis",
        description:
          "Non-empty when the source includes video, selecting video wording and the visual-analysis guidelines.",
      },
      {
        name: "documentTypeDescriptor",
        description: "Human-readable description of the document type.",
        default: "content",
      },
      {
        name: "selectedSections",
        description: "Bullet list of the requested note sections.",
      },
      {
        name: "timestamps",
        description: "Non-empty when key-moment timestamps should be included.",
      },
      {
        name: "extraPrompt",
        description: "Optional extra context appended after the guidelines.",
      },
    ],
  },
  {
    id: "content/extract",
    task: "content-extraction",
    title: "Content extraction summary",
    description: "Summarises extracted web content with accurate citations.",
    text: "You are a helpful assistant that summarizes web content. Focus on providing accurate, relevant information while maintaining proper citation of sources.",
  },
  {
    id: "document/section/concise-summary",
    task: "document-notes",
    title: "Note section: concise summary",
    description: "Section label for a concise summary in generated notes.",
    text: "Concise Summary",
  },
  {
    id: "document/section/detailed-outline",
    task: "document-notes",
    title: "Note section: detailed outline",
    description: "Section label for a detailed outline in generated notes.",
    text: "Detailed Outline",
  },
  {
    id: "document/section/key-takeaways",
    task: "document-notes",
    title: "Note section: key takeaways",
    description: "Section label for key takeaways in generated notes.",
    text: "Key Takeaways",
  },
  {
    id: "document/section/action-items",
    task: "document-notes",
    title: "Note section: action items",
    description: "Section label for action items in generated notes.",
    text: "Action Items",
  },
  {
    id: "document/section/meeting-minutes",
    task: "document-notes",
    title: "Note section: meeting minutes",
    description: "Section label for meeting minutes in generated notes.",
    text: "Meeting Minutes",
  },
  {
    id: "document/section/qa-extraction",
    task: "document-notes",
    title: "Note section: Q&A extraction",
    description: "Section label for question and answer extraction in generated notes.",
    text: "Q&A Extraction",
  },
  {
    id: "document/section/scene-analysis",
    task: "document-notes",
    title: "Note section: scene analysis",
    description: "Section label for scene analysis in generated notes.",
    text: "Scene Analysis",
  },
  {
    id: "document/section/visual-insights",
    task: "document-notes",
    title: "Note section: visual insights",
    description: "Section label for visual insights in generated notes.",
    text: "Visual Insights",
  },
  {
    id: "document/section/smart-timestamps",
    task: "document-notes",
    title: "Note section: smart timestamps",
    description: "Section label for smart timestamps in generated notes.",
    text: "Smart Timestamps",
  },
  {
    id: "document/type/general",
    task: "document-notes",
    title: "Document type descriptor: general",
    description: "Descriptor for general document content in generated notes.",
    text: "general content",
  },
  {
    id: "document/type/meeting",
    task: "document-notes",
    title: "Document type descriptor: meeting",
    description: "Descriptor for meeting content in generated notes.",
    text: "a meeting with multiple speakers",
  },
  {
    id: "document/type/training",
    task: "document-notes",
    title: "Document type descriptor: training",
    description: "Descriptor for training content in generated notes.",
    text: "a training session",
  },
  {
    id: "document/type/lecture",
    task: "document-notes",
    title: "Document type descriptor: lecture",
    description: "Descriptor for lecture content in generated notes.",
    text: "an academic lecture",
  },
  {
    id: "document/type/interview",
    task: "document-notes",
    title: "Document type descriptor: interview",
    description: "Descriptor for interview content in generated notes.",
    text: "an interview",
  },
  {
    id: "document/type/recording",
    task: "document-notes",
    title: "Document type descriptor: recording",
    description: "Descriptor for recording content in generated notes.",
    text: "a recording episode",
  },
  {
    id: "document/type/webinar",
    task: "document-notes",
    title: "Document type descriptor: webinar",
    description: "Descriptor for webinar content in generated notes.",
    text: "a webinar",
  },
  {
    id: "document/type/tutorial",
    task: "document-notes",
    title: "Document type descriptor: tutorial",
    description: "Descriptor for tutorial content in generated notes.",
    text: "an instructional tutorial",
  },
  {
    id: "document/type/video-content",
    task: "document-notes",
    title: "Document type descriptor: video content",
    description: "Descriptor for video content in generated notes.",
    text: "video content",
  },
  {
    id: "document/type/educational-video",
    task: "document-notes",
    title: "Document type descriptor: educational video",
    description: "Descriptor for educational video content in generated notes.",
    text: "an educational video",
  },
  {
    id: "document/type/documentary",
    task: "document-notes",
    title: "Document type descriptor: documentary",
    description: "Descriptor for documentary content in generated notes.",
    text: "a documentary",
  },
  {
    id: "document/type/other",
    task: "document-notes",
    title: "Document type descriptor: other",
    description: "Fallback descriptor for unknown document types.",
    text: "content",
  },
] as const satisfies readonly PromptEntry[];
