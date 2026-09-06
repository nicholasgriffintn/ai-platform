# ADR 0076: Give the desktop shell a core that owns egress

Status: Implemented in `apps/desktop`; not yet released.

The application is not packaged or signed, so nothing here has shipped to anyone. Do not describe it as available to users.

## Problem

Polychat carries two different meanings of "local". The web application executes WebLLM models in the browser, while Ollama and LM Studio providers live inside the deployed API Worker. A Worker running on Cloudflare cannot reach a customer's loopback interface, so those providers only work for a self-hosted deployment that can already see the runtime. Neither path gives someone a private chat against a model on their own machine, and the model selector compounds the confusion by treating chat mode as a proxy for execution location.

Reaching a device-local runtime needs an application on the device. The choice of shell is a durable boundary rather than a packaging preference, because it decides where session credentials live, what a compromised renderer dependency can reach, and which language the team must maintain alongside TypeScript.

## Decision

Build the desktop application on Tauri with a Rust core, and make that core the only thing that talks to the network.

The core owns four capabilities and no product logic: allowlisted HTTP egress to device and network runtimes, local storage, operating-system credential storage, and deep links with the loopback sign-in listener. Conversation state machines, prompt construction and policy stay in TypeScript in the webview, shared with the web application through the existing component and library packages behind a typed backend port that can be replaced with a fake.

The desktop application ships no interface of its own. It renders the same `ConversationThread` the web application renders, wraps it in the same providers, and adds only what a desktop needs: a sign-in gate, SQLite storage for chats the account keeps off the server, and the runtime backend. A component written for the desktop alone would be a defect.

Runtime egress is allowlisted per destination. A loopback runtime and any endpoint the person has explicitly configured pass through the same core commands, and the core refuses an address it was not given. Reaching loopback from the core rather than the webview also avoids requiring people to reconfigure the cross-origin settings of their own runtime installation.

The hosted API is the exception, and deliberately so. The webview calls it directly over HTTPS with the shared API client, because routing it through the core would mean a desktop-only transport underneath code both applications share, and the divergence costs more than the isolation buys. The content security policy names the API origin and nothing else.

Generations stream over a per-request channel whose lifetime is the request, and cancelling a generation means aborting that request rather than calling a separate endpoint.

The desktop application cannot be used signed out: there is no offline mode and no anonymous mode, and the model catalogue is always the one the API returns for this account. Asking for it with `surface=desktop` is what adds the device runtimes; the web application never sees them.

Storage follows the account's choice rather than where the model ran. Conversations sync with the service unless the person marks a chat temporary or has turned on temporary chats by default, and that policy is the same code the web application runs. A temporary chat is written to SQLite on the device, partitioned by the signed-in account, and its content never reaches the API. Signing out hides local history rather than destroying it, so deleting it is an explicit and irreversible action.

Sign-in reuses the native client flow already serving iOS, with a loopback redirect and PKCE rather than a custom scheme as the primary path, and stores the session through operating-system credential protection.

## Consequences

The renderer becomes genuinely unprivileged, which is a stronger position than the equivalent Electron design reaches by convention. The cost is paid elsewhere. The application runs on the operating system's webview, so behaviour diverges across platforms and the Linux webview lags far enough that Linux is best-effort rather than supported. Playwright cannot drive the packaged window, and the available WebDriver route does not cover macOS, so shared behaviour is tested against the fake backend, packaged coverage runs on the platforms WebDriver reaches, and macOS packaged behaviour becomes an operator verification item.

Rust enters the monorepo. Keeping the core to those four capabilities keeps it small enough to read in one sitting; a feature that needs the core to grow a new concept is a signal that the logic belongs in TypeScript instead.

The Worker's Ollama and LM Studio chat providers are removed. A Worker cannot reach a customer's loopback interface, so they only ever worked for a self-hosted deployment, and keeping them meant two implementations of the same idea. Their model definitions stay in the catalogue, marked `runsOn: "device"`, and the desktop executes them through the core. Removing WebLLM from the web application is a staged deprecation with an export window rather than a cutover, because someone who cannot install a desktop application would otherwise lose their history.

Installer signing, notarisation and update-signing keys gate release rather than code, so they are procured before implementation starts.
