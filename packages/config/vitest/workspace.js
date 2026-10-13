const sourceCondition = "polychat-source";
const defaultClientConditions = ["module", "browser", "development|production"];
const defaultServerConditions = ["module", "node", "development|production"];

export const workspaceSourceResolve = {
  resolve: { conditions: [sourceCondition, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [sourceCondition, ...defaultServerConditions] } },
};
