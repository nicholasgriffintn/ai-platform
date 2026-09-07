const dependencyBuilds = [{ task: "build", from: ["dependencies", "devDependencies"] }];

export function packageTaskConfig({ build }) {
  return {
    run: {
      tasks: {
        build: {
          command: build,
          dependsOn: dependencyBuilds,
          input: [{ auto: true }, "!dist/**"],
          output: ["dist/**"],
        },
      },
    },
  };
}
