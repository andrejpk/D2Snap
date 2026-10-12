import { type DOM } from "./types.js";
import { d2Snap as _d2Snap, normalizeDOM as _normalizeDOM } from "./D2Snap.js";
import { adaptiveD2Snap as _adaptiveD2Snap } from "./AdaptiveD2Snap.js";
export declare function d2Snap(domOrString: DOM | string, ...args: Parameters<typeof _d2Snap> extends [unknown, ...infer T] ? T : never): Promise<import("./types.js").D2SnapResult>;
export declare function normalizeDOM(domOrString: DOM | string, ...args: Parameters<typeof _normalizeDOM> extends [unknown, ...infer T] ? T : never): Promise<import("./types.js").NormalizeDOMResult>;
export declare function adaptiveD2Snap(domOrString: DOM | string, ...args: Parameters<typeof _adaptiveD2Snap> extends [unknown, unknown, ...infer T] ? T : never): Promise<import("./AdaptiveD2Snap.js").AdaptiveD2SnapResult>;
export type { D2SnapOptions, D2SnapResult, NormalizeDOMOptions, NormalizeDOMResult, NodeNormalizerFn, NormalizerContext, ElementClassifierFn, SentenceRankerFn, AttributeScoring } from "./types.js";
export type { AdaptiveD2SnapResult } from "./AdaptiveD2Snap.js";
export * as defaults from "./constants.defaults.js";
