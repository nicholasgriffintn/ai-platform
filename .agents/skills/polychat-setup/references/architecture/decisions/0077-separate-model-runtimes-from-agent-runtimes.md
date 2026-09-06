# ADR 0077: Separate model runtimes from agent runtimes

Status: Accepted design; not implemented.

This design depends on the desktop shell described in [0076](0076-desktop-core-owns-egress.md) and is not implemented. Do not describe any of it as available behaviour.

## Problem

Reaching a runtime on someone's own machine was first scoped as a single local provider contract: probe it, list its models, stream a completion, cancel. That shape fits Ollama and LM Studio, which serve models and hold no state between requests.

It does not fit the self-hosted agent gateways people now run beside them. Those daemons own their own conversation loop, memory, tool sandbox and messaging channels, and they choose their own model provider. Modelling one as a provider in the existing lineup produces a selector that offers an entry it cannot drive, because there is no model to pick and no completion to stream. It also hides the more important difference: connecting to one is the authority to execute code on the machine it runs on, which no completion endpoint implies.

The local half of the fixed tier lineup has a related problem. Its entries name models that may not exist on any particular device, so a tier can advertise something the machine cannot run.

## Decision

Define two contracts and keep them distinct everywhere, including in the selector.

A **model runtime** serves stateless completions and Polychat owns everything around them: the conversation, the prompt, tool selection and memory. It probes readiness without side effects, lists the models actually installed together with their real context limits, streams a completion, and cancels by aborting. It declares its own capabilities rather than having them assumed, and it reports failure as a distinct state — not running, model missing, model loading, out of memory, context exceeded, cancelled — because each one has a different remedy and different wording.

An **agent runtime** exposes stateful sessions and owns its own loop, memory, tools and subagents. Polychat is a surface onto it: pair with the endpoint, list and resume sessions, send a prompt, subscribe to updates, answer permission requests, cancel a run, and report which machine is executing. A session someone began in another channel is resumable in Polychat, and Polychat does not pretend to have authored it.

Authority follows the difference. An agent runtime connection executes code, so its credential is held by the desktop core and never reaches the webview, every consequential action requires explicit approval in Polychat, and no blanket standing approval exists. Polychat does not weaken whatever authentication the gateway already enforces.

Endpoints are reached on loopback by default. A network address is permitted, because running a gateway on a home server and using a laptop as its surface is a real arrangement, but the person types the address; Polychat does not discover endpoints by scanning. Each endpoint is approved once, recorded, and revocable in one place, and a network agent runtime requires a protected transport or a pairing secret because of what it can be asked to do. Egress remains allowlisted in the core, so a configured endpoint widens the allowlist by exactly itself.

Local tiers become a preference ordering applied to models actually discovered on the device rather than a catalogue. When none of a tier's candidates are present, the tier is empty and says so.

## Consequences

Both kinds of runtime can be added as adapters without either distorting the other, and adding a further coding agent or inference server later is an adapter rather than a change to the selector's model. The contracts belong to Polychat rather than to any vendor, so a gateway is pinned to a version, probed for capability when it connects, and degraded to read-only when it reports something unrecognised.

Two costs follow. Per-action approval is correct for a first release and will not survive daily use unchanged, so the interaction needs its own design pass rather than a later loosening of the rule. And an external gateway running against hosted Polychat models spends tokens outside a Polychat conversation, so usage attribution and plan limits have to express that traffic before it is offered.
