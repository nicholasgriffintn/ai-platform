# Record work for release verification

Polychat deploys by hand, and most changes arrive from agent sessions nobody watched. Static checks prove a change compiles and that its tests pass; they do not prove the product still behaves. By the time a deploy comes round, the person running it no longer remembers which changes need a human eye, and reconstructing that from a hundred commits is slower and less accurate than writing it down when the work was fresh.

So write it down when the work is fresh. Every agent that changes behaviour leaves behind one verification item: what changed, what the operator must do first, and the steps a human follows to confirm it works.

## What to record

Record an item when a change alters something a person could notice or an operator has to act on:

- behaviour on any surface: web, iOS, API, sandbox worker, training worker
- a new capability, setting, route, permission, or piece of navigation
- a removed or renamed capability, especially where saved data outlives it
- a database migration, a backfill, or a destructive schema change
- a new secret, binding, Durable Object, queue, bucket, or external callback
- an authorisation, privacy, or security boundary
- reliability or performance behaviour that only shows under load, cancellation, or provider failure

Do not record internal refactors, type-only work, test-only changes, dependency bumps, or anything a typecheck, lint rule, or unit test already proves. A list padded with those stops being read, and an unread list is worse than none.

One judgement call decides it: if this change were broken in production, would a human notice before an alarm did? If yes, record it.

## Where items live

One Markdown file per change under `.agents/verification/pending/`, named `<yyyy-mm-dd>-<slug>.md`.

A file per change rather than one shared list, because branches land in parallel all day and a shared list conflicts on every merge. Filenames sort chronologically, which is close enough to the order a person wants to work through them. Where a deploy needs operator actions before anything else can be checked, gather them into a single `<yyyy-mm-dd>-00-deploy-prerequisites.md` so it sorts first.

Group by user-visible outcome, not by pull request. Four commits that together change how a model is chosen are one item; one commit that changes both OCR and the agents contract is two.

## Item format

```md
# What changed, named the way a person would say it

- **Change:** one or two sentences, in product language.
- **Surfaces:** web, iOS, API, sandbox, training — only those that apply.
- **Prerequisites:** migrations, secrets, bindings, or external configuration this needs, or `none`.
- **Risk if wrong:** what breaks, and for whom.
- **Commits:** `abc1234` (#1234), `def5678` (#1235)

## Verify

- [ ] An action, with the result to expect.
- [ ] The failure path, not only the happy one.

**Stop and report if:** the observable symptom that means this is broken rather than merely surprising.
```

Rules for the steps:

- Write them for someone who has not read the diff. Name the screen, the route, the setting, and the button.
- Give the expected result in the same step. A step with no expected result cannot fail.
- Cover the reverse state. If the change adds a way in, verify the way out.
- Cover the failure path where the change claims one: cancellation, provider timeout, refused authorisation, missing configuration.
- Prefer checks against the deployed product. Where a check only needs an API call, give the exact request.
- Never tick a box on the user's behalf. Where an agent proved something automatically, say so in the item and leave the box for the human.

## Rebuilding the backlog from the last deployment

When items are missing — an earlier session skipped this, or a fork is being adopted — reconstruct them from the deployment boundary. Cloudflare records deployments; the repository records commits; the join is the timestamp.

```sh
npx wrangler deployments list --config apps/api/wrangler.json --name assistant | grep '^Created' | tail -1
npx wrangler deployments list --config apps/app/wrangler.jsonc | grep '^Created' | tail -1
```

Take the earlier of the two timestamps, find the commit that was current then, and read everything since:

```sh
git log -1 --format='%H %ci %s' --before='<timestamp>'
git log --format='%h %ci %s' --since='<timestamp>' --reverse
git diff --name-status <deployed-commit>..HEAD -- 'apps/api/migrations/*'
git diff <deployed-commit>..HEAD -- apps/api/.dev.vars.example apps/api/wrangler.jsonc.example
git diff --name-status <deployed-commit>..HEAD -- .agents/skills/polychat-setup/references/architecture/decisions
```

The timestamp mapping is an inference, not a record: it assumes the deploy ran from a clean tree at the tip. Say so when presenting the backlog, and confirm the boundary with the user if the range looks wrong. New architecture decisions and new migrations are the fastest route to the changes that actually need verifying — a decision was written because something load-bearing changed, and a migration means production data moves.

Classify each commit before writing anything: skip dependency bumps, lockfile maintenance, test-only and lint-only commits, and internal refactors. Fold the rest into outcome-shaped items. Say in the handoff how many commits were reviewed and how many were deliberately skipped, so the user can see the coverage rather than trust it.

## After a deploy

The user verifies against the deployed product, so the items survive the deploy that makes them checkable. Once verified:

- Move the checked items into `.agents/verification/archive/<yyyy-mm-dd>-<deployed-commit>/`. The directory name is the record of what was deployed and when.
- Leave failed items in `pending/`, with a note of the observed behaviour. A failed item is evidence; do not edit it to match what happened.
- Never archive an item nobody checked. If a change shipped unverified, say so and leave it pending.
