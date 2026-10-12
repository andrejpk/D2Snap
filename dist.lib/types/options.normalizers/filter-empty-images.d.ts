import { type NormalizerContext } from "../types.js";
export interface FilterEmptyImagesSettings {
    labelAttributeNames: readonly string[];
}
export declare const DEFAULT_SETTINGS: Readonly<FilterEmptyImagesSettings>;
declare const _default: (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<FilterEmptyImagesSettings> | undefined) => void;
export default _default;
