import { Hono } from "hono";

import github from "./github";
import sms from "./sms";
import composio from "./composio";

const webhooks = new Hono();

webhooks.route("/github", github);

webhooks.route("/sms", sms);

webhooks.route("/composio", composio);

export default webhooks;
