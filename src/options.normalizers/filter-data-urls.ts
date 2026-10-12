import { type NormalizerContext } from "../types.js";
import { forAttributes } from "./util.normalizers.js";


export interface FilterDataURLsSettings {
	attributeNames: readonly string[];
	valuePattern: RegExp;
}


export const DEFAULT_SETTINGS: Readonly<FilterDataURLsSettings> = Object.freeze({
	attributeNames: Object.freeze([ "src" ]),
	valuePattern: /^data:/i
});


export default forAttributes<FilterDataURLsSettings>((
	virtualAttr: Attr,
	_liveAttr: Attr,
	_context: NormalizerContext,
	settings: Partial<FilterDataURLsSettings> = {}
): void => {
	const attributeNames: readonly string[] = settings.attributeNames ?? DEFAULT_SETTINGS.attributeNames;
	const valuePattern: RegExp = settings.valuePattern ?? DEFAULT_SETTINGS.valuePattern;

	if(
		!attributeNames.some((attributeName: string) => attributeName.toLowerCase() === virtualAttr.name.toLowerCase())
			|| !valuePattern.test(virtualAttr.value)
	) return;

	virtualAttr.ownerElement?.removeAttribute(virtualAttr.name);
});
