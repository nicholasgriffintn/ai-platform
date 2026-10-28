---
"@assistant/api": patch
"@assistant/app": patch
---

Teammates hear about red builds and requested changes. Once a teammate links the pull request it opened with `link_pull_request`, a failing CI run or a "changes requested" review on it sends the task back to that teammate with the failing checks or the review to fix, and passing CI is noted on the task. When a teammate reviewer asks for changes, its notes now go straight into the owner's next run. You can give a task both a builder and a reviewer, such as QA: set the reviewer when you create the task or from its page, and they are woken as soon as the builder's work is ready. Publishing a Polychat pull request review can also send its findings back to the task that opened the pull request.
