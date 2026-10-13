export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends (...args: never[]) => unknown ? T[P] : T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type TextNode = Node & {
    nodeType: number;
    textContent: string;
    innerText?: string;
};
export type DOM = Document | Element;
export type ElementClassifierFn<T> = (element: T) => boolean;
export type NodeNormalizerFn = (virtualNode: Node, liveNode: Node, context: NormalizerContext) => void;
export type SentenceRankerFn = (sentences: string[]) => string[];
export interface NormalizerContext {
    classifiers: D2SnapOptions["classifiers"];
    document: Document;
}
export interface ElementWithDepth extends HTMLElement {
    depth: number;
}
export interface AttributeScoring {
    [name: string]: number;
}
export interface TextRankSettings {
    damping: number;
    maxIterations: number;
    minSimilarity: number;
    tolerance: number;
}
export interface D2SnapOptions {
    attributeScores: AttributeScoring;
    classifiers: {
        actionableElement: ElementClassifierFn<Element>;
        textFormattingElement: ElementClassifierFn<Element>;
    };
    debug: boolean;
    filterEmptyElements: boolean;
    normalizers: readonly NodeNormalizerFn[];
    /** One ranker, or null for no ranking (leading sentences are kept). */
    sentenceRanker: SentenceRankerFn | null;
    skip: {
        markdown: boolean;
        textRank: boolean;
    };
    minify: boolean;
    shadowDOM: boolean;
    uniqueIDs: boolean;
}
/** Downsampling ratios: specific ratios (rE, rA, rT) fall back to r, else to 0 (no reduction). */
export interface D2SnapRatios {
    r?: number;
    rE?: number;
    rA?: number;
    rT?: number;
}
/** Argument forms of d2Snap() following the DOM (e.g., to pass all forms through a wrapper). */
export type D2SnapArgs = [rE: number, rA: number, rT: number, options?: DeepPartial<D2SnapOptions>] | [ratios: D2SnapRatios, options?: DeepPartial<D2SnapOptions>];
/** Pre-processing subset of the snapshot options (normalization without downsampling). */
export type NormalizeDOMOptions = Pick<D2SnapOptions, "classifiers" | "normalizers" | "shadowDOM" | "uniqueIDs">;
export interface NormalizeDOMResult {
    dom: Element;
    innerHTML: string;
    html: string;
    outerHTML: string;
}
export interface D2SnapResult {
    dom: Element;
    innerHTML: string;
    html: string;
    outerHTML: string;
    meta: {
        tokenEstimate: number;
        originalSize: number;
        sizeRatio: number;
        snapshotSize: number;
        /** Per-pass wall-clock timings in ms. Only present when `debug: true`. */
        timings?: {
            [step: string]: number;
        };
    };
}
