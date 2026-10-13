export const VOID_TAG_NAMES: Set<string> = new Set([
	"AREA",
	"BASE",
	"BR",
	"COL",
	"EMBED",
	"HR",
	"IMG",
	"INPUT",
	"LINK",
	"META",
	"PARAM",
	"SOURCE",
	"TRACK",
	"WBR"
]);

export const INLINE_TAG_NAMES: Set<string> = new Set([
	"A",
	"ABBR",
	"B",
	"BDI",
	"BDO",
	"CITE",
	"CODE",
	"DATA",
	"DFN",
	"EM",
	"I",
	"KBD",
	"MARK",
	"Q",
	"RP",
	"RT",
	"RUBY",
	"S",
	"SAMP",
	"SMALL",
	"SPAN",
	"STRONG",
	"SUB",
	"SUP",
	"TIME",
	"U",
	"VAR",
	"WBR",
	"BR"
]);

export const RAW_TEXT_TAG_NAMES: Set<string> = new Set([
	"IFRAME",
	"NOSCRIPT",
	"SCRIPT",
	"STYLE",
	"TEXTAREA",
	"TITLE",
]);

// Whitespace is content (may contain markup, unlike raw text elements).
export const PREFORMATTED_TAG_NAMES: Set<string> = new Set([
	"PRE"
]);

export const NON_RENDERED_TAG_NAMES: Set<string> = new Set([
	"SCRIPT",
	"STYLE",
	"NOSCRIPT",
	"TEMPLATE"
]);

export const SVG_LABEL_TAG_NAMES: string[] = [
	"title",
	"desc"
];

// HTML widget + composite role attribute values that reasonably map to a native HTML tag name.
export const ACTIONABLE_ROLE_ATTRIBUTE_VALUES: string[] = [
	"button",
	"checkbox",
	"link",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
	"option",
	"radio",
	"searchbox",
	"slider",
	"spinbutton",
	"switch",
	"textbox",
	"combobox",
	"listbox"
];