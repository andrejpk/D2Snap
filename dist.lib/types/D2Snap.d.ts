import { type DeepPartial, type D2SnapOptions, type D2SnapResult, type DOM, type NormalizeDOMOptions, type NormalizeDOMResult, type D2SnapArgs, type D2SnapRatios } from "./types.js";
export declare function resolveD2SnapArgs(args: D2SnapArgs): {
    rE: number;
    rA: number;
    rT: number;
    options: DeepPartial<D2SnapOptions>;
};
export declare function getAttributeScore(attrName: string, attributeScores?: Map<string, number>): number;
export declare function normalizeDOM(dom: DOM, options?: DeepPartial<NormalizeDOMOptions>): NormalizeDOMResult;
export declare function d2Snap(dom: DOM, rE: number, rA: number, rT: number, options?: DeepPartial<D2SnapOptions>): D2SnapResult;
export declare function d2Snap(dom: DOM, ratios: D2SnapRatios, options?: DeepPartial<D2SnapOptions>): D2SnapResult;
export declare function d2Snap(dom: DOM, ...args: D2SnapArgs): D2SnapResult;
