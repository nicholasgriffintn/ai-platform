const dependencyBuilds = [{ task: "build", from: ["dependencies", "devDependencies"] }];

export const packageTaskConfig = {
  run: {
    tasks: {
      build: {
        command: "tsup",
        dependsOn: dependencyBuilds,
        input: [{ auto: true }, "!dist/**"],
        output: ["dist/**"],
      },
    },
  },
};
