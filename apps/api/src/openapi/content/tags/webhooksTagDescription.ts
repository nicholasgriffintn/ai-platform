import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const webhooksTagDescription = md`
# Webhooks

Receive platform events at your own URL. Polychat POSTs each subscribed event to the endpoint with a \`Polychat-Event-Id\` header and a \`Polychat-Signature\` header:

~~~
Polychat-Signature: t=1760430000,v1=<hex HMAC-SHA256 of "{t}.{raw body}">
~~~

The signing secret is returned once on create and once on rotation. Rotating invalidates the old secret immediately. Send a test event to check delivery.
`;
