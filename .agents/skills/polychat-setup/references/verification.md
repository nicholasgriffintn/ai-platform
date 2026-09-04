# Record release verification

Leave a verification item when a change needs a human or operator to confirm behaviour that static checks cannot prove. Include visible behaviour, permissions, migrations, bindings, external configuration and failure recovery. Skip documentation-only changes and internal work already proved by automated checks.

## Record an item

Use one Markdown file per outcome under `.agents/verification/pending/`, named `<yyyy-mm-dd>-<slug>.md`. Group deployment prerequisites in a `00-deploy-prerequisites` item when several changes depend on them.

```md
# User-visible outcome

- **Change:** what changed.
- **Surfaces:** only the affected web, iOS, API, sandbox or training surfaces.
- **Prerequisites:** migrations, secrets, bindings or external actions; otherwise none.
- **Risk if wrong:** what breaks and for whom.
- **Commits:** known commit or PR references, when available.

## Verify

- [ ] Perform the named action and observe the expected result.
- [ ] Check the relevant reverse operation and failure path.

**Stop and report if:** the observable failure condition.
```

Write for someone who has not read the change. Name the screen or API request and expected result. Never tick a human-verification box on the user's behalf; record automated evidence separately.

## Reconstruct missing items

When asked to rebuild the backlog, inspect the latest successful Cloudflare deployments for each affected Worker using its active configuration. Prefer recorded deployed revision metadata. If only timestamps exist, infer the likely revision from history and label that inference: deployment time does not prove which commit or uncommitted tree ran.

Review changes since the earliest relevant deployment, especially migrations, example configuration, bindings and user-visible behaviour. Follow the repository's git authorisation rules. Group related changes by outcome and omit maintenance-only changes. Report the reviewed range and uncertainty instead of treating an empty queue as proof nothing needs checking.

## Close items

After the user verifies the deployed result, move checked items into `.agents/verification/archive/<yyyy-mm-dd>-<deployed-commit>/`. Leave failed or unchecked items pending with the observed result. Do not weaken steps to match a failure or archive work merely because it deployed.
