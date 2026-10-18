# Record release verification

Most changes need no verification item. Tests, typechecks and the changeset are the record. Leave one only when a deploy needs a person to confirm behaviour on real infrastructure, credentials or devices that automated checks cannot reach, such as a new binding, a migration, an external provider or a device-only path. Keep it to the checks that remain.

## Record an item

Use one Markdown file per outcome under `.agents/verification/pending/`, named `<yyyy-mm-dd>-<slug>.md`.

```md
# User-visible outcome

- **Change:** what changed.
- **Surfaces:** only the affected web, iOS, desktop, API, sandbox worker or agent worker.
- **Prerequisites:** migrations, secrets, bindings or external actions; otherwise none.
- **Risk if wrong:** what breaks and for whom.
- **Commits:** known commit or PR references, when available.

## Verify

- [ ] Perform the named action and observe the expected result.
- [ ] Check the relevant reverse operation and failure path.

**Stop and report if:** the observable failure condition.
```

Write for someone who has not read the change. Name the screen or API request and expected result. Never tick a human-verification box on the user's behalf, and do not copy test results into the item.

## Reconstruct missing items

When asked to rebuild the backlog, inspect the latest successful Cloudflare deployments for each affected Worker using its active configuration. Prefer recorded deployed revision metadata. If only timestamps exist, infer the likely revision from history and label that inference: deployment time does not prove which commit or uncommitted tree ran.

Review changes since the earliest relevant deployment, especially migrations, example configuration, bindings and user-visible behaviour. Follow the repository's git authorisation rules. Group related changes by outcome and omit maintenance-only changes. Report the reviewed range and uncertainty instead of treating an empty queue as proof nothing needs checking.

## Close items

After the user verifies the deployed result, move checked items into `.agents/verification/archive/<yyyy-mm-dd>-<deployed-commit>/`. Leave failed or unchecked items pending with the observed result. Do not weaken steps to match a failure or archive work merely because it deployed.
