import { type NormalizerContext } from "../types.js";
import { forComments } from "./util.normalizers.js";


export interface FilterCommentsSettings {
	keepPattern: RegExp | null;
}


export const DEFAULT_SETTINGS: Readonly<FilterCommentsSettings> = Object.freeze({
	keepPattern: null
});


export default forComments<FilterCommentsSettings>((
	virtualComment: Comment,
	_liveComment: Comment,
	_context: NormalizerContext,
	settings: Partial<FilterCommentsSettings> = {}
): void => {
	const keepPattern: RegExp | null = settings.keepPattern ?? DEFAULT_SETTINGS.keepPattern;

	if(keepPattern?.test(virtualComment.data)) return;

	virtualComment.parentNode?.removeChild(virtualComment);
});
