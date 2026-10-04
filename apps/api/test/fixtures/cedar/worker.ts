import { authorise, ownsResource } from "@ngriffin_uk/polychat-library-policy";

export default {
  fetch() {
    return Response.json({
      allow: ownsResource(7, 7),
      deny: ownsResource(7, 8),
      excluded: authorise("capability.use", { granted: true, excluded: true }).allowed,
      service: authorise("service.call", {
        authenticated: true,
        scopes: ["preview"],
        requiredScope: "preview",
      }).allowed,
    });
  },
};
