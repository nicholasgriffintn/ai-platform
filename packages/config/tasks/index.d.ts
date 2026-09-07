export interface PackageTaskConfigOptions {
  build: string | string[];
}

export interface PackageTaskConfig {
  run: {
    tasks: {
      build: {
        command: string | string[];
        dependsOn: Array<{ task: string; from: string[] }>;
        input: Array<string | { auto: boolean }>;
        output: string[];
      };
    };
  };
}

export declare function packageTaskConfig(options: PackageTaskConfigOptions): PackageTaskConfig;
