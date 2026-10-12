import { NodeType } from "./enums.js";


const DATA_URL_ATTRIBUTE_NAME: string = "src";
const DATA_URL_ATTRIBUTE_VALUE_REGEX: RegExp = /^data:/i;


export default function(virtualNode: Node): void {
	if(virtualNode.nodeType !== NodeType.ATTRIBUTE_NODE) return;

	const virtualAttr = virtualNode as Attr;

	if(
		(virtualAttr.name.toLowerCase() !== DATA_URL_ATTRIBUTE_NAME)
			|| !DATA_URL_ATTRIBUTE_VALUE_REGEX.test(virtualAttr.value)
	) return;

	virtualAttr.ownerElement?.removeAttribute(virtualAttr.name);
}
