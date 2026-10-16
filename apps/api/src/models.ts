import { createRepositories } from "~/infrastructure/database/repositories";
import { listModelBenchmarkStandings } from "~/modules/benchmarks/application/boards";
import { machineModelSource } from "~/modules/machines/application/model-source";
import { platformModelSource } from "~/modules/model-serving/application/model-source";
import { registerModelSource, registerModelStandings } from "~/modules/models/application/sources";

registerModelSource(machineModelSource);
registerModelSource(platformModelSource);
registerModelStandings((env, userId) =>
  listModelBenchmarkStandings(createRepositories(env), userId),
);
