import type { ScenarioDataset } from "@perception-bench/scenarios";

type SeedRequest = ScenarioDataset["requests"][number];
export type RequestRecord = Omit<SeedRequest, "owner"> & { owner: string };
