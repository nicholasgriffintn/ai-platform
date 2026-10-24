import type { ChatSuggestion } from "@ngriffin_uk/polychat-library-react";

import type { FileType } from "../Library/file-items.js";

type AskCategory = "research" | "writing" | "everyday" | "image";

const FILE_ASK_PROMPTS: Record<FileType, ReadonlyArray<readonly [string, AskCategory]>> = {
  result: [
    ["Summarise this result", "research"],
    ["What should I do with this?", "everyday"],
    ["Check this for mistakes", "research"],
    ["What is missing from it?", "everyday"],
  ],
  document: [
    ["Summarise this in five bullet points", "research"],
    ["What questions does this leave open?", "everyday"],
    ["Tighten the opening paragraph", "writing"],
    ["Check this for mistakes", "research"],
  ],
  note: [
    ["Turn this note into a checklist", "writing"],
    ["What is missing from this?", "everyday"],
    ["Expand this into a draft", "writing"],
    ["Summarise this in one line", "research"],
  ],
  image: [
    ["Describe this image", "image"],
    ["What text is in this image?", "image"],
    ["Suggest a caption", "writing"],
    ["What stands out first?", "everyday"],
  ],
  audio: [
    ["Summarise this recording", "research"],
    ["List the action items with timestamps", "everyday"],
    ["Who said what?", "research"],
    ["What was decided?", "everyday"],
  ],
  video: [
    ["Summarise this video", "research"],
    ["List the key moments with timestamps", "everyday"],
    ["Write a short description", "writing"],
    ["What was decided?", "everyday"],
  ],
  podcast: [
    ["Summarise this episode", "research"],
    ["Pull out the best quotes", "writing"],
    ["Write show notes", "writing"],
    ["What would a listener take away?", "everyday"],
  ],
  link: [
    ["Summarise this page", "research"],
    ["What is the main claim?", "research"],
    ["Is this source reliable?", "everyday"],
    ["What should I read next?", "everyday"],
  ],
  connected: [
    ["Summarise this record", "research"],
    ["What changed recently?", "research"],
    ["What needs a reply?", "writing"],
    ["Who is involved?", "everyday"],
  ],
  memory: [
    ["What does this tell you about me?", "everyday"],
    ["Is anything here out of date?", "research"],
    ["Suggest a clearer version", "writing"],
    ["What is missing?", "everyday"],
  ],
  folder: [
    ["Summarise everything in here", "research"],
    ["What do these have in common?", "research"],
    ["What is missing?", "everyday"],
    ["Which one should I read first?", "everyday"],
  ],
};

export function buildFileAskSuggestions(type: FileType): ChatSuggestion[] {
  return FILE_ASK_PROMPTS[type].map(([prompt, category], index) => ({
    id: `file-ask-${type}-${index}`,
    label: prompt,
    prompt,
    category,
  }));
}
