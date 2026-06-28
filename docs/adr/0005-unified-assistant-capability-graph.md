# ADR 0005: Unified assistant capability graph

## Status

Accepted.

## Context

Assistant capabilities are discovered through recipes, dynamic apps, connectors, agents, hosted model tools, and function tools. Before this decision, launch facts lived in the assistant action catalogue, app and recipe descriptors carried separate capability metadata, connector read/write risk lived in the connector registry, and model-tool compatibility was mostly inferred by filtering.

That made the product graph shallow. Callers could discover a capability, but still needed family-specific knowledge to explain availability, model compatibility, connector requirements, auth state, approval policy, and execution risk.

## Decision

Use `AssistantCapabilityDescriptor` as the shared product graph node for assistant actions. Catalogue items carry both `capability` and `launch`: `capability` explains whether and why the item is available, and `launch` explains how selection executes.

Connector operation tools are generated from the connector provider registry so operation names, read/write access, approval metadata, and executable tools do not drift from the connector adapter registry. Runtime execution still goes through the existing connector operation path.

## Trade-offs

The shared descriptor is broader, and catalogue builders must provide sensible defaults for every capability family. The benefit is locality: picker UI, composer actions, connector tools, and future marketplace packaging can reason over one product graph without duplicating provider, model, auth, or approval rules.
