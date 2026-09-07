# ADR 0033: Separate compute site from conversation retention

Status: Implemented across the shared chat runtime and desktop storage boundary.

## Problem

The chat runtime previously treated a response produced on a device as temporary, regardless of the account's retention choice. It also exposed a browser-persisted `localOnlyMode` that duplicated the server-backed temporary-chat default and made unrelated account, plan and compute decisions appear to be one setting.

## Decision

Resolve compute site and retention independently. `ConversationStorageMode` reports `kept` or `temporary`, the reason for that result, and whether the request is project-scoped. Authentication and plan entitlement remain hard storage boundaries; explicit temporary choice and the account's temporary default apply to personal conversations; a device model does not force temporary retention.

Temporary conversations remain in the host's local conversation store. Kept conversations, including conversations answered by device or browser models, use the normal remote persistence path. The per-conversation retention control states that keeping a device-run transcript uploads it before performing that promotion.

Remove `localOnlyMode` from the persisted chat store and extend the existing v4 migration so older browser state loses only that field. Copy is selected from the policy reason so signed-out, plan-limited, default-temporary and explicitly temporary conversations are distinguishable to the person using the product.

## Consequences

Model execution can move between hosted, browser and device runtimes without silently changing where the conversation is kept. A retained local-model response has to complete a remote transcript write, so that write is part of the stream finalisation path and can surface a failure. Project conversations continue to be kept because their scope is shared, while temporary personal conversations stay device-private.
