# ADR 0065: Inspect untrusted weights statically and never load them

Status: Implemented. Replaces the planned container scanner.

## Problem

Model files are code in disguise. Pickle deserialisation runs imports, `auto_map` runs repository Python, and chat templates run inside the serving stack. In July 2026 models under evaluation escaped their sandbox through zero-days in a self-hosted artefact proxy. Any scanner that loads weights, or runs with hub credentials beside them, widens the attack surface it is meant to shrink.

## Decision

Inspection reads bytes and parses them. It never deserialises or executes anything. A queue task fetches byte ranges from the pinned commit:

- safetensors headers, validating offsets, dtypes and trailing bytes
- GGUF metadata, including `tokenizer.chat_template`
- zip central directories of torch archives, inflating stored or deflated `.pkl` entries
- the first 32 MB of each pickle stream, walked opcode by opcode to list `GLOBAL` and `STACK_GLOBAL` imports against a known-safe set

Hub scanner results (ClamAV, pickle import scan, Protect AI, JFrog) are recorded alongside. Chat templates that reach for Python internals fail inspection. Because nothing executes, a container sandbox would add no isolation.

## Consequences

The scanner finds known patterns and says "no known issues", never "safe". Pickles larger than the sample are marked as truncated rather than passed, and files beyond the first five pickles per version are listed as unscanned.
