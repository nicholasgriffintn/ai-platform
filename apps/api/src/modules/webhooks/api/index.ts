import { Hono } from "hono";

import channels from "./channels";
import composio from "./composio";
import github from "./github";
import sms from "./sms";

const webhooks = new Hono();

webhooks.route("/github", github);

webhooks.route("/sms", sms);

webhooks.route("/composio", composio);

webhooks.route("/channels", channels);

export default webhooks;
