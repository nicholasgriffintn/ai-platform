const dependencyBuilds = [{ task: "build", from: ["dependencies", "devDependencies"] }];

const styleOutputs = ["dist/styles.js", "dist/*.css", "dist/*.css.map"];

export function packageTaskConfig({ build }) {
  const [bundle, ...styles] = Array.isArray(build) ? build : [build];
  const input = [{ auto: true }, "!dist/**"];

  if (styles.length === 0) {
    return {
      run: {
        tasks: {
          build: {
            command: bundle,
            dependsOn: dependencyBuilds,
            input,
            output: ["dist/**"],
          },
        },
      },
    };
  }

  return {
    run: {
      tasks: {
        "build:styles": {
          command: styles.join(" && "),
          dependsOn: dependencyBuilds,
          input,
          output: styleOutputs,
        },
        build: {
          command: bundle,
          dependsOn: [...dependencyBuilds, "build:styles"],
          input,
          output: ["dist/**", ...styleOutputs.map((output) => `!${output}`)],
        },
      },
    },
  };
}
