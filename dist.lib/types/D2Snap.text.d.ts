import { type ElementClassifierFn, type SentenceRankerFn } from "./types.js";
export interface SiblingElement {
    element: Element;
    position: number;
}
export declare function snapTextSiblings(textNodes: Text[], siblingElements: SiblingElement[], ratio: number, sentenceRanker: SentenceRankerFn, isActionableElement: ElementClassifierFn<Element>): void;
export declare function snapTextBlocks(root: Element, ratio: number, sentenceRanker: SentenceRankerFn, isActionableElement: ElementClassifierFn<Element>): void;
