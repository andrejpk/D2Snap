import { type NormalizerContext } from "../types.js";
export interface FilterAttributesSettings {
    attributeNames: readonly string[];
}
export declare const DEFAULT_SETTINGS: Readonly<FilterAttributesSettings>;
declare const _default: (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<FilterAttributesSettings> | undefined) => void;
export default _default;
