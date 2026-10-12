import { type NodeNormalizerFn } from "./types.js";
import filterAttributes from "./normalizer.filterAttributes.js";
import filterComments from "./normalizer.filterComments.js";
import filterDataURLs from "./normalizer.filterDataURLs.js";
import filterElements from "./normalizer.filterElements.js";
import filterEmptyImages from "./normalizer.filterEmptyImages.js";
import iconClassesToImg from "./normalizer.iconClassesToImg.js";
import labelAttributesToContent from "./normalizer.labelAttributesToContent.js";
import svgToImg from "./normalizer.svgToImg.js";


export {
	filterAttributes,
	filterComments,
	filterDataURLs,
	filterElements,
	filterEmptyImages,
	iconClassesToImg,
	labelAttributesToContent,
	svgToImg
};


// STRICT ORDER MATTERS

export const DEFAULT_NORMALIZERS: NodeNormalizerFn[] = [
	filterComments,
	filterElements,
	filterEmptyImages,
	svgToImg,
	iconClassesToImg,
	labelAttributesToContent,
	filterAttributes,
	filterDataURLs
];
