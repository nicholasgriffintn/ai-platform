import { Hono } from "hono";

import github from "./github";

const webhooks = new Hono();
webhooks.route("/github", github);

export default webhooks;
