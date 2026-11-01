---
"@assistant/api": minor
"@ngriffin_uk/polychat-ai-workflows": minor
"@ngriffin_uk/polychat-library-tasks": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-component-navigation": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-utility-server": minor
"@assistant/app": minor
---

Background work now starts straight away instead of waiting in line. Each task (knowledge indexing, Discover jobs, recipe runs, Work task runs and the rest) runs as its own Cloudflare Workflow, so a long Discover job no longer holds up everything behind it.

- Retries pick up where a task failed instead of starting the whole task again, with growing pauses between attempts.
- A Discover edition's follow-up work (covers, research, the listen, the episode, links, your week and tidying) now runs as one workflow, with each piece as its own step. Each episode chapter is scripted, narrated and illustrated in separate steps, so a failed illustration no longer means re-narrating the chapter.
- Gathering reads each service and researches each topic as its own step, and knowledge indexing keeps its paid enrichment when only the embedding needs another try.
- Polling tasks check back on a timer inside one run instead of queuing a fresh task each time.
- Scheduled tasks sleep until they are due, however far away that is.
- Background tasks have moved out of profile settings into a new Admin area at `/admin`, reached from the settings menu. It shows what is running, waiting, scheduled and waiting on someone, a last-day summary per task type with average turnaround, and each task's live workflow status and every step attempt with its timing and error. Failed tasks can be run again and open ones cancelled from there.
- Cancelling a task now stops its workflow run too.
- Episodes, The Perch and other written pieces are much quicker. Writing that doesn't need reasoning now really runs without it on Workers AI, so an episode chapter is scripted in seconds rather than several minutes.
- Long structured writing such as podcast scripts and episode chapters streams its result instead of waiting on one long request, so it no longer fails with Workers AI request timeouts. A model that goes quiet for a minute hands over to the next model in the lineup.
- Voices for episodes, podcasts and wind downs are recorded several passages at a time, and a podcast's script, recording, storage and cover are separate steps, so a failed recording no longer pays for the script again.
- Discover editions now see everything gathered for them. Tool results are no longer cut short before the model reads them, so followed topics get their news.
- The newest Discover edition is always the one shown, whichever way its time was recorded.
- Saving the same document twice no longer runs its paid enrichment twice.
