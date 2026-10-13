import { type NormalizerContext } from "../types.js";
export interface NormalizeIconClassesToImgsSettings {
    iconClassPrefixes: readonly string[];
    labelAttributeNames: readonly string[];
}
export declare const DEFAULT_SETTINGS: Readonly<NormalizeIconClassesToImgsSettings>;
declare const _default: (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<NormalizeIconClassesToImgsSettings> | undefined) => void;
export default _default;
