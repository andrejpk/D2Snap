import { type NormalizerContext } from "../types.js";
export interface NormalizeSvgsToImgsSettings {
    labelAttributeNames: readonly string[];
}
export declare const DEFAULT_SETTINGS: Readonly<NormalizeSvgsToImgsSettings>;
declare const _default: (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<NormalizeSvgsToImgsSettings> | undefined) => void;
export default _default;
