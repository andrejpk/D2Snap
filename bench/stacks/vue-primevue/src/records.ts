import { dataset } from "@perception-bench/scenarios";

export type RequestRecord = {
  id: string;
  supplier: string;
  amount: string;
  status: string;
  owner: string;
};

export const freshRequests = (): RequestRecord[] => dataset.requests.map(record => ({ ...record }));
