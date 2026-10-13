import { type NormalizerContext } from "../types.js";
export interface FilterCommentsSettings {
    keepPattern: RegExp | null;
}
export declare const DEFAULT_SETTINGS: Readonly<FilterCommentsSettings>;
declare const _default: (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<FilterCommentsSettings> | undefined) => void;
export default _default;
