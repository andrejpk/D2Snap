import { type NormalizerContext } from "../types.js";
export interface AssignUniqueIdsSettings {
    attributeName: string;
}
export declare const DEFAULT_SETTINGS: Readonly<AssignUniqueIdsSettings>;
declare const _default: (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<AssignUniqueIdsSettings> | undefined) => void;
export default _default;
