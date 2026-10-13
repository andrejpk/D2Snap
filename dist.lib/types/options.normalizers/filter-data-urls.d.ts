import { type NormalizerContext } from "../types.js";
export interface FilterDataUrlsSettings {
    attributeNames: readonly string[];
    valuePattern: RegExp;
}
export declare const DEFAULT_SETTINGS: Readonly<FilterDataUrlsSettings>;
declare const _default: (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<FilterDataUrlsSettings> | undefined) => void;
export default _default;
