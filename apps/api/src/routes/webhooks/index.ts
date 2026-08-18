import { Hono } from "hono";

import composio from "./composio";
import github from "./github";
import sms from "./sms";

const webhooks = new Hono();

webhooks.route("/github", github);

webhooks.route("/sms", sms);

webhooks.route("/composio", composio);

export default webhooks;
