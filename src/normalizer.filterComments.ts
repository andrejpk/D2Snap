import { NodeType } from "./enums.js";


export default function(virtualNode: Node): void {
	if(virtualNode.nodeType !== NodeType.COMMENT_NODE) return;

	virtualNode.parentNode?.removeChild(virtualNode);
}
