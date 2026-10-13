import { d2Snap } from "../../../src/D2Snap.ts";
import { subjectOptions } from "./subject-options.ts";

globalThis.perceptionSubject = (configuration) => {
  return d2Snap(document, configuration.rE, configuration.rA, configuration.rT, subjectOptions(configuration.options)).html;
};
