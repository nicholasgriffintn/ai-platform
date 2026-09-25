---
"@assistant/api": patch
---

Count unread task notifications across the whole inbox. `unread` used to be counted from the returned page only, which is at most 50 rows by default, so it stopped at the page size. `TaskNotificationRepository.countUnreadInbox` now counts over the same filter `listInbox` uses, so "N unread" labels and the Attention badges show the real total.
