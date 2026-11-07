# @ngriffin_uk/polychat-library-tasks

## 0.3.1

### Patch Changes

- Updated dependencies [fd91d91]
- Updated dependencies [150be98]
- Updated dependencies [8a4bbaf]
- Updated dependencies [b571a91]
  - @ngriffin_uk/polychat-utility-server@0.8.0

## 0.3.0

### Minor Changes

- 80afaf2: Background work now starts straight away instead of waiting in line. Each task (knowledge indexing, Discover jobs, recipe runs, Work task runs and the rest) runs as its own Cloudflare Workflow, so a long Discover job no longer holds up everything behind it.

  - Retries pick up where a task failed instead of starting the whole task again, with growing pauses between attempts.
  - A Discover edition's follow-up work (covers, research, the listen, the episode, links, your week and tidying) now runs as one workflow, with each piece as its own step. Each episode chapter is scripted, narrated and illustrated in separate steps, so a failed illustration no longer means re-narrating the chapter.
  - Gathering reads each service and researches each topic as its own step, and knowledge indexing keeps its paid enrichment when only the embedding needs another try.
  - Polling tasks check back on a timer inside one run instead of queuing a fresh task each time.
  - Scheduled tasks sleep until they are due, however far away that is, and a task that is already overdue when its run starts goes straight ahead.
  - A task whose workflow run stops unexpectedly is picked up again within about 15 minutes instead of sitting in the queue. After repeated stops it is marked failed with the workflow's error.
  - Background tasks have moved out of profile settings into a new Admin area at `/admin`, reached from the settings menu. It shows what is running, waiting, scheduled and waiting on someone, a last-day summary per task type with average turnaround, and each task's live workflow status and every step attempt with its timing and error. Failed tasks can be run again and open ones cancelled from there.
  - Cancelling a task now stops its workflow run too.
  - Episodes, The Perch and other written pieces are much quicker. Writing that doesn't need reasoning now really runs without it on Workers AI, so an episode chapter is scripted in seconds rather than several minutes.
  - Long structured writing such as podcast scripts and episode chapters streams its result instead of waiting on one long request, so it no longer fails with Workers AI request timeouts. A model that goes quiet for a minute hands over to the next model in the lineup.
  - Voices for episodes, podcasts and wind downs are recorded several passages at a time, and a podcast's script, recording, storage and cover are separate steps, so a failed recording no longer pays for the script again.
  - Discover editions now see everything gathered for them. Tool results are no longer cut short before the model reads them, so followed topics get their news.
  - The newest Discover edition is always the one shown, whichever way its time was recorded.
  - Saving the same document twice no longer runs its paid enrichment twice.

### Patch Changes

- Updated dependencies [80afaf2]
  - @ngriffin_uk/polychat-utility-server@0.7.0

## 0.2.4

### Patch Changes

- Updated dependencies [5d70d5d]
  - @ngriffin_uk/polychat-utility-server@0.6.0

## 0.2.3

### Patch Changes

- Updated dependencies [48eb3dc]
  - @ngriffin_uk/polychat-utility-server@0.5.0

## 0.2.2

### Patch Changes

- Updated dependencies [e0ca7c6]
- Updated dependencies [187afde]
  - @ngriffin_uk/polychat-utility-server@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [80fee8e]
  - @ngriffin_uk/polychat-utility-server@0.3.0

## 0.2.0

### Minor Changes

- ece96c4: Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.

### Patch Changes

- Updated dependencies [ece96c4]
- Updated dependencies [4968623]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [b105d00]
- Updated dependencies [b105d00]
- Updated dependencies [57f8a16]
  - @ngriffin_uk/polychat-utility-server@0.2.0
