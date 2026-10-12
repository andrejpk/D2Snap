import { type NormalizerContext } from "../types.js";
export interface FilterNoiseElementsSettings {
    tagNames: readonly string[];
}
export declare const DEFAULT_SETTINGS: Readonly<FilterNoiseElementsSettings>;
declare const _default: (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<FilterNoiseElementsSettings> | undefined) => void;
export default _default;
