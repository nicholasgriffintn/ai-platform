# ADR 0024: Declare sandbox delivery, setup and services explicitly

Status: Implemented.

## Problem

A single commit toggle blurred local preparation, branch changes and pull requests. Setup commands, cached environments and background services also lacked a scoped contract that could be reviewed and safely repeated.

## Decision

- Store delivery intent with the project configuration. Validate before delivery, require the runner's exact approval before a remote write, resolve a fresh GitHub App token and recheck target-branch protection at the write boundary. Configuration never grants authority by itself.
- Define environment setup through saved project configuration or `.polychat/environment.json` at the checked-out revision. Run commands through the existing command and approval policy. Setup configuration does not grant access to secrets.
- Reuse snapshots only for the same project, initiating runner, repository, revision and setup inputs. Exclude credentials, Git metadata, environment files and logs; invalidate snapshots when their authority or inputs change.
- Declare services with a repository-relative working directory, dependencies, bounded health checks and restart policy. Validate them after cloning, start in dependency order and stop them when the run ends.
- Expose previews only for a healthy declared service port and revalidate membership, run state and session authority for every request.
- Govern environment variables separately from setup configuration. Permit writes only to workspace owners or admins, and never return stored values to clients.
- Permit only a short, opt-in post-run inspection window for the initiating runner. Apply the existing command policy and approval rules, then destroy the environment when the window closes.

## Consequences

Project setup and delivery take more configuration and approval, but intent, authority and remote writes remain separate. Runs can resume from scoped snapshots and services without turning cached files, setup commands or custom instructions into authority. Snapshot storage and an optional inspection window add operational cost.
