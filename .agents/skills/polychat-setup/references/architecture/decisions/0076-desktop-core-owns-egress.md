# ADR 0076: Give the desktop shell a core that owns egress

Status: Accepted design; not implemented.

This design describes a desktop application that does not yet exist. Do not describe any of it as available behaviour.

## Problem

Polychat carries two different meanings of "local". The web application executes WebLLM models in the browser, while Ollama and LM Studio providers live inside the deployed API Worker. A Worker running on Cloudflare cannot reach a customer's loopback interface, so those providers only work for a self-hosted deployment that can already see the runtime. Neither path gives someone a private chat against a model on their own machine, and the model selector compounds the confusion by treating chat mode as a proxy for execution location.

Reaching a device-local runtime needs an application on the device. The choice of shell is a durable boundary rather than a packaging preference, because it decides where session credentials live, what a compromised renderer dependency can reach, and which language the team must maintain alongside TypeScript.

## Decision

Build the desktop application on Tauri with a Rust core, and make that core the only thing that talks to the network.

The core owns four capabilities and no product logic: allowlisted HTTP egress, local storage, operating-system credential storage, and deep links with the loopback sign-in listener. Conversation state machines, prompt construction and policy stay in TypeScript in the webview, shared with the web application through the existing component and library packages behind a typed backend port that can be replaced with a fake.

Egress is allowlisted per destination. The hosted API, a loopback runtime and any endpoint the person has explicitly configured all pass through the same core commands, so the webview is served with no remote connection permitted to it at all and never holds an access token. A dependency compromised inside the renderer has no route out that the core does not already name. Reaching loopback from the core rather than the webview also avoids requiring people to reconfigure the cross-origin settings of their own runtime installation.

Generations stream over a per-request channel whose lifetime is the request, and cancelling a generation means aborting that request rather than calling a separate endpoint.

Device-local conversations are stored on the device, partitioned by the signed-in Polychat account, and their content never reaches the API. Remote conversations stay server-authoritative. Moving between device and cloud execution starts a new conversation; local history is never uploaded to make a handoff work. Signing out hides local history rather than destroying it, so deleting it is an explicit and irreversible action.

Sign-in reuses the native client flow already serving iOS, with a loopback redirect and PKCE rather than a custom scheme as the primary path, and stores the session through operating-system credential protection.

## Consequences

The renderer becomes genuinely unprivileged, which is a stronger position than the equivalent Electron design reaches by convention. The cost is paid elsewhere. The application runs on the operating system's webview, so behaviour diverges across platforms and the Linux webview lags far enough that Linux is best-effort rather than supported. Playwright cannot drive the packaged window, and the available WebDriver route does not cover macOS, so shared behaviour is tested against the fake backend, packaged coverage runs on the platforms WebDriver reaches, and macOS packaged behaviour becomes an operator verification item.

Rust enters the monorepo. Keeping the core to those four capabilities keeps it small enough to read in one sitting; a feature that needs the core to grow a new concept is a signal that the logic belongs in TypeScript instead.

The Worker's Ollama and LM Studio providers are not removed, because a self-hosted deployment on the same network can legitimately reach a runtime. They require an explicitly configured non-loopback address and are hidden from the hosted product. Removing WebLLM from the web application is likewise a staged deprecation with an export window rather than a cutover, because someone who cannot install a desktop application would otherwise lose their history.

Installer signing, notarisation and update-signing keys gate release rather than code, so they are procured before implementation starts.
