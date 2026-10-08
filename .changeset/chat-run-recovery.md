---
"@assistant/api": patch
---

Settle dead chat runs without waiting for someone to open them. A scheduled sweep reconciles running or cancelling runs whose thread lease has lapsed, and streamed text is checkpointed on the run so an interrupted turn keeps its partial reply as a stopped message instead of losing it.
