import { type D2SnapOptions } from "./types.js";
type DOMPreProcessingOptions = Pick<D2SnapOptions, "classifiers" | "normalizers" | "shadowDOM">;
interface DOMPostProcessingOptions {
    filterEmptyElements: boolean;
    minify: boolean;
}
interface HTMLPostProcessingOptions {
    debug: boolean;
}
export declare function preProcessDOM(virtualDomRoot: Element, liveDomRoot: Element, document: Document, options: DOMPreProcessingOptions): void;
export declare function postProcessDOM(domRoot: Element, options: DOMPostProcessingOptions, isActionableElement: (elementNode: Element) => boolean): void;
export declare function postProcessHTML(html: string, options: Partial<HTMLPostProcessingOptions>): string;
export {};
