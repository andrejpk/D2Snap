import { type NormalizerContext } from "../types.js";
export interface NormalizeTextLabelAttributesToContentSettings {
    labelAttributeNames: readonly string[];
}
export declare const DEFAULT_SETTINGS: Readonly<NormalizeTextLabelAttributesToContentSettings>;
declare const _default: (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<NormalizeTextLabelAttributesToContentSettings> | undefined) => void;
export default _default;
