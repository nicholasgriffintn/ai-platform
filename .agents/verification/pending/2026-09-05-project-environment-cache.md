# Project environment cache

Verify with a disposable coding project whose setup produces a visible dependency or build artefact.

- Run the project from a clean environment. Confirm Activity and Proof report a created snapshot, and project coding settings show its creation time, repository/setup revisions and size when available.
- Run the same revision again as the same member. Confirm Proof reports a reused snapshot with its age and that resume commands run instead of full setup.
- Change a lockfile, checked-out revision or setup definition. Confirm the next run reports a miss and performs full setup.
- Request **Rebuild**. Confirm settings show immediate invalidation and the next run performs full setup before recording a replacement.
- Request **Delete** while no run is active. Confirm the setting becomes invalidated and a later run does not reuse it.
- Delete or expire the stored backup while leaving its project record. Confirm restoration reports failure, the clone is cleaned and full setup succeeds without stale files.
- Start two clean runs together. Confirm only one same-key snapshot remains current and the other run still completes.
- Delete or rebuild while a run is preparing. Confirm the older run cannot repopulate the invalidated generation when it finishes.
- Remove the runner's project membership before completion. Confirm its new snapshot is discarded and no cache handle appears in project responses, run records or streamed events.
