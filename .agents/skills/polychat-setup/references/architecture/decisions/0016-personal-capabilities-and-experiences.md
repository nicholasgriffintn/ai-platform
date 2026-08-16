# ADR 0016: Personal capabilities and experiences

## Status

Accepted

## Context

ADR 0006 removed the global apps and recipes destinations, and ADR 0007 restored rich workflows as project experiences. Both decisions assumed that anything worth a durable interface was collaborative, so a person with no workspace lost notes, article research, podcast processing, media-model runs, and recipe management entirely.

Personal use does not need a sharing boundary, but it does need the same interfaces. The API was already capable of it: every app data route treats `projectId` as optional and returns user-owned rows when it is absent, and the iOS client already depends on that behaviour.

The project capability library also conflated two different things. Every function tool was auto-registered as a dynamic app, so agent-loop plumbing such as `add_reasoning_step` appeared under Apps and again under Tools, and enabling the app copy wrote a capability record that authorised nothing.

## Decision

Nest personal surfaces under `/chat` as sibling routes to the conversation: `experiences`, `experiences/:experienceId/*`, `capabilities`, and `tools/:toolId`. Chat and Work remain the only two product modes; `/apps` is not restored.

Represent scope as a parameter rather than a fork. A `CapabilitySurface` carries a base path and an optional project ID, and one set of components — the capability library, the experience grid and renderer, the tool runner — serves both scopes. Work passes a project; Chat passes nothing.

Give a person everything by default. Experiences and tools need no personal enablement record at all: a project curates what its members may reach for, but a person already has their own. Recipes remain the exception, because they carry credentials, schedules, and triggers, and their existing installation record already expresses that opt-in. There is therefore no personal capability table.

Project capability enablement remains authorisation, because project data is shared between members. Personal data routes stay authorised by user ownership and plan alone. Carry the distinction as `requiresExplicitEnablement` on the capability scope, so the shared library renders an add affordance for a project and simply shows what is available for a person.

Publish experiences and model tools from `/capabilities`, and function tools from `/tools`. A function tool is never an app: the curated experience catalogue is the only source of enableable apps, and an "app" is simply an experience that declares an owning `capabilityId`.

Keep running a tool from the interface as a first-class capability. `/tools/:id` returns a form derived from the tool's own input schema, and `/tools/:id/execute` runs it and stores the result as an output. Model tools are not runnable this way and are marked accordingly in the action catalogue.

## Trade-offs

Personal experiences inherit the existing `requirePlan("pro")` gating on notes, articles, and podcasts, so the personal library needs an honest upgrade state rather than an empty grid. Opening those to the free tier is a separate plan-policy decision.

A recipe installed both personally and in a project produces two installations with separate credentials and schedules. ADR 0010 chose this deliberately, and personal scope extends rather than changes it.

Demoting function tools from apps invalidates any project capability record that pointed at one. Those records never enabled a working experience, so they are deleted rather than migrated, and a project that listed one simply stops showing it.

Because nothing is enabled personally, the personal capability library is a browsing and recipe-setup surface rather than a selection one. If personal curation is ever wanted — pinning a shortlist, hiding what a person never uses — it becomes a presentation preference rather than an authorisation record.
