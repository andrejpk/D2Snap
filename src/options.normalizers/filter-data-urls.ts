import { type NormalizerContext } from "../types.js";
import { forAttributes } from "./util.normalizers.js";


export interface FilterDataUrlsSettings {
	attributeNames: readonly string[];
	valuePattern: RegExp;
}


export const DEFAULT_SETTINGS: Readonly<FilterDataUrlsSettings> = Object.freeze({
	attributeNames: Object.freeze([ "src" ]),
	valuePattern: /^data:/i
});


export default forAttributes<FilterDataUrlsSettings>((
	virtualAttr: Attr,
	_liveAttr: Attr,
	_context: NormalizerContext,
	settings: Partial<FilterDataUrlsSettings> = {}
): void => {
	const attributeNames: readonly string[] = settings.attributeNames ?? DEFAULT_SETTINGS.attributeNames;
	const valuePattern: RegExp = settings.valuePattern ?? DEFAULT_SETTINGS.valuePattern;

	if(
		!attributeNames
			.some((attributeName: string) => (attributeName.toLowerCase() === virtualAttr.name.toLowerCase()))
	) return;

	valuePattern.lastIndex = 0;

 	if(!valuePattern.test(virtualAttr.value)) return;

	virtualAttr.ownerElement?.removeAttribute(virtualAttr.name);
});