# ADR 0011: Retain audit history after workspace deletion

## Status

Accepted

## Problem

Workspace audit records are the immutable governance history, but their cascading foreign key deleted that history with the workspace. This contradicted the audit contract and removed the final deletion event.

## Decision

Retain `workspace_audit_record` rows independently of the workspace lifecycle. Store the workspace identifier without a cascading foreign key and record `workspace.deletion.requested` before hard deletion begins.

## Trade-off

Retained records can reference a workspace that no longer exists and are intended for administrative or compliance retrieval rather than the ordinary workspace UI. Hard deletion still removes collaborative content and membership data.
