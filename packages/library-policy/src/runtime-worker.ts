import * as cedar from "@cedar-policy/cedar-wasm/web";

import module from "./cedar.wasm";

let initialised = false;

function initialiseCedar(): void {
  if (!initialised) {
    cedar.initSync({ module });
    initialised = true;
  }
}

export const checkParsePolicySet: typeof cedar.checkParsePolicySet = (policies) => {
  initialiseCedar();

  return cedar.checkParsePolicySet(policies);
};

export const isAuthorized: typeof cedar.isAuthorized = (call) => {
  initialiseCedar();

  return cedar.isAuthorized(call);
};

export const policySetTextToParts: typeof cedar.policySetTextToParts = (source) => {
  initialiseCedar();

  return cedar.policySetTextToParts(source);
};

export const policyToJson: typeof cedar.policyToJson = (policy) => {
  initialiseCedar();

  return cedar.policyToJson(policy);
};

export const preparsePolicySet: typeof cedar.preparsePolicySet = (id, policies) => {
  initialiseCedar();

  return cedar.preparsePolicySet(id, policies);
};

export const preparseSchema: typeof cedar.preparseSchema = (id, schema) => {
  initialiseCedar();

  return cedar.preparseSchema(id, schema);
};

export const statefulIsAuthorized: typeof cedar.statefulIsAuthorized = (call) => {
  initialiseCedar();

  return cedar.statefulIsAuthorized(call);
};

export const validate: typeof cedar.validate = (call) => {
  initialiseCedar();

  return cedar.validate(call);
};
