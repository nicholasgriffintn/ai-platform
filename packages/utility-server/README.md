# @ngriffin_uk/polychat-utility-server

Server-side helpers shared by the API and the Workers: errors, ids, retries, streaming, JSON and multipart parsing, redaction, SQL helpers, and tool-call parsing. Nothing here touches Cloudflare bindings or a vendor SDK.

Import from the root or from a subpath so a Worker only pulls what it uses:

```ts
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { withRetries } from "@ngriffin_uk/polychat-utility-server/retries";
```

Logging lives in `@ngriffin_uk/polychat-ai-telemetry`, not here, so log records can reach telemetry sinks.
