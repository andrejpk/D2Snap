import {
	type D2SnapOptions,
	type NodeNormalizerFn
} from "./types.js";
import isActionableElement from "./options.classifiers/is-actionable-element.js";
import isTextElement from "./options.classifiers/is-text-element.js";
import {
	filterAttributes,
	filterComments,
	filterDataUrls,
	filterNoiseElements,
	filterEmptyImages,
	normalizeIconClassesToImgs,
	normalizeTextLabelAttributesToContent,
	normalizeSvgsToImgs
} from "./options.normalizers.js";
import textRank from "./options.sentenceRankers/text-rank.js";
import { DEFAULT_SETTINGS as IS_ACTIONABLE_ELEMENT_SETTINGS } from "./options.classifiers/is-actionable-element.js";
import { DEFAULT_SETTINGS as IS_TEXT_ELEMENT_SETTINGS } from "./options.classifiers/is-text-element.js";
import { DEFAULT_SETTINGS as FILTER_ATTRIBUTES_SETTINGS } from "./options.normalizers/filter-attributes.js";
import { DEFAULT_SETTINGS as FILTER_COMMENTS_SETTINGS } from "./options.normalizers/filter-comments.js";
import { DEFAULT_SETTINGS as FILTER_DATA_URLS_SETTINGS } from "./options.normalizers/filter-data-urls.js";
import { DEFAULT_SETTINGS as FILTER_NOISE_ELEMENTS_SETTINGS } from "./options.normalizers/filter-noise-elements.js";
import { DEFAULT_SETTINGS as FILTER_EMPTY_IMAGES_SETTINGS } from "./options.normalizers/filter-empty-images.js";
import { DEFAULT_SETTINGS as NORMALIZE_ICON_CLASSES_TO_IMGS_SETTINGS } from "./options.normalizers/normalize-icon-classes-to-imgs.js";
import { DEFAULT_SETTINGS as NORMALIZE_TEXT_LABEL_ATTRIBUTES_TO_CONTENT_SETTINGS } from "./options.normalizers/normalize-text-label-attributes-to-content.js";
import { DEFAULT_SETTINGS as NORMALIZE_SVGS_TO_IMGS_SETTINGS } from "./options.normalizers/normalize-svgs-to-imgs.js";
import { DEFAULT_SETTINGS as ASSIGN_UNIQUE_IDS_SETTINGS } from "./options.normalizers/assign-unique-ids.js";
import { DEFAULT_SETTINGS as TEXT_RANK_SETTINGS } from "./options.sentenceRankers/text-rank.js";


// Default callbacks (individually, incl. opt-in ones; reusable in custom subsets, supersets, or orders).

export * as classifiers from "./options.classifiers.js";
export * as normalizers from "./options.normalizers.js";
export * as sentenceRankers from "./options.sentenceRankers.js";

// Defaults as passed to the respective options (reusable in custom subsets, supersets, or orders).

export const ATTRIBUTE_SCORES = Object.freeze({
	// Maximum preservance:
	"data-uid": 1.00,
	"role": 1.00,
	"alt": 1.00,

	// Affordance-frequency balanced (to render rA a latent ratio, otherwise threshold)
	"href": 0.91,
	"src": 0.83,
	"class": 0.77,
	"id": 0.68,
	"value": 0.43,
	"name": 0.40,
	"type": 0.38,
	"checked": 0.36,
	"controls": 0.36,
	"selected": 0.35,
	"disabled": 0.34,
	"readonly": 0.33,
	"required": 0.33,
	"label": 0.31,
	"lang": 0.30,
	"for": 0.30,
	"title": 0.29,
	"hidden": 0.28,
	"action": 0.27,
	"method": 0.27,
	"form": 0.26,
	"multiple": 0.26,
	"placeholder": 0.25,
	"accept": 0.24,
	"min": 0.23,
	"max": 0.23,
	"pattern": 0.22,
	"step": 0.22,
	"maxlength": 0.21,
	"minlength": 0.21,
	"srcset": 0.20,
	"sizes": 0.19,
	"rel": 0.18,
	"enctype": 0.17,
	"target": 0.17,
	"autofocus": 0.16,
	"tabindex": 0.16,
	"autocomplete": 0.15,
	"contenteditable": 0.15,
	"datetime": 0.15,
	"style": 0.10,
	"content": 0.05,
	"loop": 0.04,
	"muted": 0.04,
	"size": 0.04,
	"media": 0.03,
	"autoplay": 0.03,
	"poster": 0.03,
	"preload": 0.02,
	"spellcheck": 0.02,
	"download": 0.02,
	"hreflang": 0.02,
	"novalidate": 0.02,
	"accept-charset": 0.01,
	"autocapitalize": 0.01,
	"draggable": 0.01,
	"cite": 0.01,
	"usemap": 0.01,
	"ismap": 0.00,
	"dropzone": 0.00,
	"accesskey": 0.00,
	"coords": 0.00,
	"shape": 0.00,
	"ping": 0.00,
	"wrap": 0.01,
	"http-equiv": 0.01,

	"aria-*": 0.62,

	// Fallback:
	"*": 0.00
});

export const CLASSIFIERS: Readonly<D2SnapOptions["classifiers"]> = Object.freeze({
	actionableElement: isActionableElement,
	textFormattingElement: isTextElement
});

// STRICT ORDER MATTERS
// Opt-in (not default): assignUniqueIds
export const NORMALIZERS: readonly NodeNormalizerFn[] = Object.freeze([
	filterComments,
	filterNoiseElements,
	filterEmptyImages,
	normalizeSvgsToImgs,
	normalizeIconClassesToImgs,
	normalizeTextLabelAttributesToContent,
	filterAttributes,
	filterDataUrls
]);

// Accepts its settings as second argument (wrap to configure).
export const SENTENCE_RANKER: typeof textRank = textRank;

// Default side parameters per callback (reusable when wrapping a callback with own settings).

export const CLASSIFIER_SETTINGS = Object.freeze({
	isActionableElement: IS_ACTIONABLE_ELEMENT_SETTINGS,
	isTextElement: IS_TEXT_ELEMENT_SETTINGS
});

export const NORMALIZER_SETTINGS = Object.freeze({
	filterAttributes: FILTER_ATTRIBUTES_SETTINGS,
	filterComments: FILTER_COMMENTS_SETTINGS,
	filterDataUrls: FILTER_DATA_URLS_SETTINGS,
	filterNoiseElements: FILTER_NOISE_ELEMENTS_SETTINGS,
	filterEmptyImages: FILTER_EMPTY_IMAGES_SETTINGS,
	normalizeIconClassesToImgs: NORMALIZE_ICON_CLASSES_TO_IMGS_SETTINGS,
	normalizeTextLabelAttributesToContent: NORMALIZE_TEXT_LABEL_ATTRIBUTES_TO_CONTENT_SETTINGS,
	normalizeSvgsToImgs: NORMALIZE_SVGS_TO_IMGS_SETTINGS,
	assignUniqueIds: ASSIGN_UNIQUE_IDS_SETTINGS
});

export const SENTENCE_RANKER_SETTINGS = Object.freeze({
	textRank: TEXT_RANK_SETTINGS
});
