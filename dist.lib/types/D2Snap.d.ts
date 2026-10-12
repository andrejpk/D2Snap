import { type DeepPartial, type D2SnapOptions, type D2SnapResult, type DOM, type NormalizeDOMOptions, type NormalizeDOMResult } from "./types.js";
export declare function getAttributeScore(attrName: string, attributeScores?: Map<string, number>): number;
export declare function normalizeDOM(dom: DOM, options?: DeepPartial<NormalizeDOMOptions>): NormalizeDOMResult;
export declare function d2Snap(dom: DOM, rE: number, rA: number, rT: number, options?: DeepPartial<D2SnapOptions>): D2SnapResult;
