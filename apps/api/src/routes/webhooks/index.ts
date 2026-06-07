import { Hono } from "hono";

import github from "./github";
import sms from "./sms";

const webhooks = new Hono();

webhooks.route("/github", github);

webhooks.route("/sms", sms);

export default webhooks;
