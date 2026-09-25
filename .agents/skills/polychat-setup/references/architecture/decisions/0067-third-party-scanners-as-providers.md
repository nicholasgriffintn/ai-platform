# ADR 0067: Add third-party model scanners as a provider category

Status: Proposed. Not built.

## Problem

Enterprises that already pay for Prisma AIRS (Protect AI Guardian) or JFrog Xray want their scanner's verdict recorded as evidence. The Hub already shows both vendors' results per file, which covers public repositories but not private uploads or other sources.

## Decision

When a customer needs it, scanners become a `model-scanner` provider category following ADR 0044 and 0045. A provider takes a pinned version reference and returns evidence rows, with bring-your-own credentials. The built-in static inspection (ADR 0065) stays the default.

## Consequences

Until then, third-party verdicts arrive only through Hub metadata.
