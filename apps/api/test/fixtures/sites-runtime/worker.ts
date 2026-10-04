export { SiteRuntime } from "../../../src/modules/sites/infrastructure/runtime";

export default {
  fetch() {
    return new Response(null, { status: 404 });
  },
};
