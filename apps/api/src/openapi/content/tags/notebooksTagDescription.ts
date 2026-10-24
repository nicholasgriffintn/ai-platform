import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const notebooksTagDescription = md`
# Notebooks

A notebook is a conversation group that also holds sources, notes and studio outputs. Every conversation in it answers from the notebook's sources, in the style and length the notebook sets.

- \`POST /notebooks\` creates one, personal or in a project. Move conversations in with \`PATCH /conversations/{id}/organisation\`, or start one inside a notebook by sending \`conversation.notebook\` with a new response.
- \`POST /notebooks/{notebook_id}/sources\` links sources by id or reads web pages into new sources. \`POST /notebooks/{notebook_id}/research\` finds pages to import, or runs deep research in the background.
- \`POST /notebooks/{notebook_id}/studio\` makes an audio overview, slide deck, data table, report, infographic, mind map, flashcards, quiz or video overview from the chosen sources.
- \`/notebooks/{notebook_id}/outputs/{output_id}/progress\` keeps your own flashcard and quiz progress.
`;
