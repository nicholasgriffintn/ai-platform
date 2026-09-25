# ADR 0068: Treat fine-tunes as versions that re-enter the gate

Status: Implemented for Hugging Face Jobs (TRL SFT, full or LoRA). SageMaker and Bedrock jobs stay available under "Provider jobs" in the Build tab.

## Problem

A fine-tune combines an approved base with data the organisation owns, and neither approval covers the result. The EU AI Act also makes a modifier a GPAI provider once modification compute passes about a third of the original training compute, so compute has to be recorded with the model.

## Decision

A build requires both inputs to be usable in scope. Rated conversations become a derived dataset version, content-addressed by example IDs, with PII and size evidence before any training starts. The job trains from the pinned base commit and pushes to a private repository in the workspace's Hub namespace.

The output is registered as a draft derived version with `fine_tuned_from` and `trained_on` lineage and an estimated `6 × parameters × tokens` compute figure. When the job completes, the output commit is pinned and inspected like any import.

## Consequences

Derived models get the same scrutiny as imports and show their compute against the threshold. Preference training (DPO) is not offered, because Polychat records ratings of single replies rather than preference pairs.
