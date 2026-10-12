import { Hono } from "hono";

import channels from "./channels";
import composio from "./composio";
import github from "./github";
import recipes from "./recipes";
import sms from "./sms";

const webhooks = new Hono();

webhooks.route("/github", github);

webhooks.route("/sms", sms);

webhooks.route("/composio", composio);

webhooks.route("/channels", channels);

webhooks.route("/recipes", recipes);

export default webhooks;
