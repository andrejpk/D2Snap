import filterAttributes from "./options.normalizers/filter-attributes.js";
import filterComments from "./options.normalizers/filter-comments.js";
import filterDataURLs from "./options.normalizers/filter-data-urls.js";
import filterElements from "./options.normalizers/filter-noise-elements.js";
import filterEmptyImages from "./options.normalizers/filter-empty-images.js";
import iconClassesToImg from "./options.normalizers/normalize-icon-classes-to-imgs.js";
import labelAttributesToContent from "./options.normalizers/normalize-text-label-attributes-to-content.js";
import svgToImg from "./options.normalizers/normalize-svgs-to-imgs.js";
import uniqueIDs from "./options.normalizers/asign-unique-ids.js";


export {
	filterAttributes,
	filterComments,
	filterDataURLs,
	filterElements,
	filterEmptyImages,
	iconClassesToImg,
	labelAttributesToContent,
	svgToImg,
	uniqueIDs
};

export { type FilterAttributesSettings } from "./options.normalizers/filter-attributes.js";
export { type FilterCommentsSettings } from "./options.normalizers/filter-comments.js";
export { type FilterDataURLsSettings } from "./options.normalizers/filter-data-urls.js";
export { type FilterElementsSettings } from "./options.normalizers/filter-noise-elements.js";
export { type FilterEmptyImagesSettings } from "./options.normalizers/filter-empty-images.js";
export { type IconClassesToImgSettings } from "./options.normalizers/normalize-icon-classes-to-imgs.js";
export { type LabelAttributesToContentSettings } from "./options.normalizers/normalize-text-label-attributes-to-content.js";
export { type SvgToImgSettings } from "./options.normalizers/normalize-svgs-to-imgs.js";
export { type UniqueIDsSettings } from "./options.normalizers/asign-unique-ids.js";
